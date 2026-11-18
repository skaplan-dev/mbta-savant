"""Per-car metrics for one ranking group and one time window, computed with DuckDB from segment Parquet.

Expected travel time is the median over every segment in the window (all vehicles) with the same
(route_id, direction, from_stop, to_stop, hour_bucket, day_type). A segment's ``dwell_sec`` is the
dwell at its ``to_stop``, so expected dwell is the median keyed on (route_id, direction, to_stop,
hour_bucket, day_type). Each segment is credited to every car in its ``cars`` list.

TTOE-family stats (TTOE, game-log TTOE) use a per-segment delta capped at TTOE_CAP_SEC, so one
disrupted trip cannot decide a rank.

Event times are whole seconds, so medians and quartiles of per-segment values land on the same integer
for nearly every car on a line. Steadiness and Door Time are therefore means, which resolve below a
second: Steadiness is the mean distance of each delta (clipped to +/-STEADY_CLIP_SEC) from the car's own
median, and Door Time is the mean dwell delta clipped to +/-DOOR_CLIP_SEC. Speed vs Expected is
``100 * (sum(expected) / sum(min(travel, expected + cap)) - 1)`` over the car's segments.

Games Played and Iron Horse are counted over the group's *data days* (window days on which the group
has any segment), so a feed outage neither lowers a car's games played nor breaks its streak.
"""

import math
import statistics
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path

import duckdb

from savant.segments import segment_glob

QUALIFY_MIN_TRIPS = 50
QUALIFY_SHARE = 0.25  # of the median trip count over all cars in the group/window
LAST30_DAYS = 30
TEAMMATES = 5
TTOE_CAP_SEC = 300
STEADY_CLIP_SEC = 60
DOOR_CLIP_SEC = 30
MEMORY_LIMIT = "4GB"


@dataclass(frozen=True)
class Window:
    key: str
    start: date
    end: date


def _segment_days(root: Path) -> list[date]:
    days = []
    for p in (Path(root) / "segments").glob("*/*/*.parquet"):
        try:
            days.append(date.fromisoformat(p.stem))
        except ValueError:
            continue  # e.g. a leftover .tmp- file
    return days


def windows(root: Path) -> list[Window]:
    """``last30`` (30 calendar days ending at the latest segment file, any group) plus one per year."""
    days = _segment_days(root)
    if not days:
        return []
    latest = max(days)
    out = [Window("last30", latest - timedelta(days=LAST30_DAYS - 1), latest)]
    for year in sorted({d.year for d in days}, reverse=True):
        out.append(Window(str(year), date(year, 1, 1), date(year, 12, 31)))
    return out


# One narrow row per (segment, car) for the window. Expected travel/dwell are medians over segments,
# computed before the unnest so a multi-car train counts once. Each segment's delta is capped at
# TTOE_CAP_SEC, so a disrupted trip counts as at most that much slower than expected.
# Bus numbers are normalized on read ("0952" -> "952") so older cached segments merge with new ones;
# non-numeric tokens fall back to the raw token.
_BUS_NUMBER = "coalesce(CAST(TRY_CAST(cars[i] AS BIGINT) AS VARCHAR), cars[i])"
_CAR_SEG = f"""
CREATE TEMP TABLE car_seg AS
SELECT service_date, trip_id, route_id, travel_sec, benchmark_sec, distance_mi, exp_travel,
  dwell_sec - exp_dwell AS dwell_delta, __NUMBER__ AS number, occupancy_pct[i] AS occ,
  least(travel_sec - exp_travel, {TTOE_CAP_SEC}) AS delta,
  least(travel_sec, exp_travel + {TTOE_CAP_SEC}) AS capped_travel
FROM (
  SELECT *, unnest(generate_series(1, len(cars))) AS i
  FROM (
    SELECT service_date, trip_id, route_id, travel_sec, dwell_sec, benchmark_sec, distance_mi, cars, occupancy_pct,
      median(travel_sec) OVER (PARTITION BY route_id, direction, from_stop, to_stop, hour_bucket, day_type)
        AS exp_travel,
      median(dwell_sec) OVER (PARTITION BY route_id, direction, to_stop, hour_bucket, day_type) AS exp_dwell
    FROM read_parquet($1) WHERE service_date BETWEEN $2 AND $3
  )
)
"""

_DATA_DAYS = "SELECT DISTINCT service_date FROM read_parquet($1) WHERE service_date BETWEEN $2 AND $3 ORDER BY 1"

_PER_CAR = f"""
WITH clipped AS (
  SELECT *, greatest(least(delta, {STEADY_CLIP_SEC}), -{STEADY_CLIP_SEC}) AS steady_delta FROM car_seg
),
own AS (SELECT number, median(steady_delta) AS steady_median FROM clipped GROUP BY number)
SELECT number,
  count(DISTINCT (service_date, trip_id)) AS trips,
  avg(delta) AS ttoe_sec,
  100 * (sum(exp_travel) / nullif(sum(capped_travel), 0) - 1) AS speed_vs_expected_pct,
  quantile_cont(distance_mi / travel_sec * 3600, 0.9) FILTER (WHERE distance_mi IS NOT NULL) AS top_speed_mph,
  avg(CASE WHEN travel_sec <= benchmark_sec THEN 100.0 ELSE 0.0 END) FILTER (WHERE benchmark_sec IS NOT NULL)
    AS on_time_pct,
  avg(abs(steady_delta - steady_median)) AS steadiness_sec,
  avg(greatest(least(dwell_delta, {DOOR_CLIP_SEC}), -{DOOR_CLIP_SEC})) AS door_time_sec,
  sum(distance_mi) AS miles,
  avg(occ) AS crowd_load_pct,
  count(DISTINCT route_id) AS routes,
  list(DISTINCT service_date) AS days
FROM clipped JOIN own USING (number) GROUP BY number ORDER BY number
"""

_GAME_LOG = """
SELECT number, service_date, count(DISTINCT trip_id), sum(distance_mi), avg(delta), list(DISTINCT route_id ORDER BY route_id)
FROM car_seg GROUP BY number, service_date ORDER BY number, service_date
"""

# Co-occurrence counted per trip, not per segment.
_TEAMMATES = """
WITH ct AS (SELECT DISTINCT service_date, trip_id, number FROM car_seg)
SELECT a.number, b.number, count(*) AS n
FROM ct a JOIN ct b USING (service_date, trip_id)
WHERE a.number <> b.number
GROUP BY a.number, b.number
ORDER BY a.number, n DESC, b.number
"""


def _iron_horse(car_days: set[str], data_days: list[str]) -> int:
    best = run = 0
    for d in data_days:
        run = run + 1 if d in car_days else 0
        best = max(best, run)
    return best


def qualify_threshold(trips: list[int]) -> int:
    """Trips needed to qualify: max(QUALIFY_MIN_TRIPS, ceil(QUALIFY_SHARE * median over all cars))."""
    if not trips:
        return QUALIFY_MIN_TRIPS
    return max(QUALIFY_MIN_TRIPS, math.ceil(QUALIFY_SHARE * statistics.median(trips)))


def car_stats(root: Path, group: str, window: Window) -> list[dict]:
    if not any((Path(root) / "segments" / group).glob("*/*.parquet")):
        return []
    is_bus = group == "bus"
    tmp = Path(root) / ".duckdb_tmp"
    tmp.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(config={"memory_limit": MEMORY_LIMIT, "temp_directory": str(tmp)})
    try:
        args = [segment_glob(root, group), window.start.isoformat(), window.end.isoformat()]
        data_days = [r[0] for r in con.execute(_DATA_DAYS, args).fetchall()]
        con.execute(_CAR_SEG.replace("__NUMBER__", _BUS_NUMBER if is_bus else "cars[i]"), args)
        per_car = con.execute(_PER_CAR)
        cols = [c[0] for c in per_car.description]
        cars = [dict(zip(cols, r)) for r in per_car.fetchall()]
        logs: dict[str, list[dict]] = {}
        for number, day, trips, miles, ttoe, routes in con.execute(_GAME_LOG).fetchall():
            logs.setdefault(number, []).append(
                {"date": day, "trips": trips, "miles": None if is_bus else miles, "ttoe_sec": ttoe, "routes": routes}
            )
        mates: dict[str, list[list]] = {}
        if not is_bus:
            for a, b, n in con.execute(_TEAMMATES).fetchall():
                if len(mates.setdefault(a, [])) < TEAMMATES:
                    mates[a].append([b, n])
    finally:
        con.close()

    threshold = qualify_threshold([c["trips"] for c in cars])
    out = []
    for c in cars:
        number, days = c.pop("number"), set(c.pop("days"))
        routes = c.pop("routes")
        out.append(
            {
                "car_id": f"{group}:{number}",
                "number": number,
                **c,
                "qualified": c["trips"] >= threshold,
                "top_speed_mph": None if is_bus else c["top_speed_mph"],
                "miles": None if is_bus else c["miles"],
                "games_played_pct": 100.0 * len(days) / len(data_days),
                "iron_horse_days": _iron_horse(days, data_days),
                "teammates": mates.get(number, []),
                "routes": routes if is_bus else None,
                "game_log": logs.get(number, []),
            }
        )
    return out
