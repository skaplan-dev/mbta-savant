"""Per-car metrics for one ranking group and one time window, computed with DuckDB from segment Parquet.

Expected travel time is the median over every segment in the window (all vehicles) with the same
(route_id, direction, from_stop, to_stop, hour_bucket, day_type). A segment's ``dwell_sec`` is the
dwell at its ``to_stop``, so expected dwell is the median keyed on (route_id, direction, to_stop,
hour_bucket, day_type). Each segment is credited to every car in its ``cars`` list.

Trip-time stats are per trip: a per-segment mean times the window's median segments per trip (median
over trips of segment count, trip = (service_date, trip_id), for the line or, on bus by_route, the
route). ``travel_time_sec`` is the mean travel delta (capped at TTOE_CAP_SEC per segment) per trip,
``dwell_time_sec`` the mean dwell delta (clipped to +/-DOOR_CLIP_SEC; null dwell counts as 0 in the
total) per trip, ``trip_time_sec`` their combined per-segment delta per trip, and ``exp_trip_sec`` the
expected travel plus dwell per trip. The game log carries ``trip_time_sec`` per day.

Event times are whole seconds, so medians and quartiles of per-segment values land on the same integer
for nearly every car on a line. Steadiness and the trip-time stats are therefore means, which resolve below a
second: Steadiness is the mean distance of each delta (clipped to +/-STEADY_CLIP_SEC) from the car's own
median.

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
# Per-route bus boards: a bus needs this many trips on the route. Each route has a core of regulars plus many
# buses that fill in for a trip or two, so the line-wide share-of-median rule would empty most route boards.
ROUTE_QUALIFY_MIN_TRIPS = 20
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
SELECT service_date, trip_id, route_id, travel_sec, benchmark_sec, distance_mi,
  __NUMBER__ AS number, occupancy_pct[i] AS occ,
  least(travel_sec - exp_travel, {TTOE_CAP_SEC}) AS delta,
  CASE WHEN dwell_sec IS NULL OR exp_dwell IS NULL THEN NULL
    ELSE greatest(least(dwell_sec - exp_dwell, {DOOR_CLIP_SEC}), -{DOOR_CLIP_SEC}) END AS dwell_clip,
  least(travel_sec - exp_travel, {TTOE_CAP_SEC}) + coalesce(dwell_clip, 0) AS seg_delta,
  exp_travel + coalesce(exp_dwell, 0) AS exp_seg
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


def _per(keys: str) -> str:
    """Per-vehicle metrics grouped by ``keys``: "number" for the line, "route_id, number" for bus routes."""
    return f"""
WITH clipped AS (
  SELECT *, greatest(least(delta, {STEADY_CLIP_SEC}), -{STEADY_CLIP_SEC}) AS steady_delta FROM car_seg
),
own AS (SELECT {keys}, median(steady_delta) AS steady_median FROM clipped GROUP BY {keys})
SELECT {keys},
  count(DISTINCT (service_date, trip_id)) AS trips,
  avg(seg_delta) AS seg_trip,
  avg(delta) AS seg_travel,
  CASE WHEN count(dwell_clip) = 0 THEN NULL ELSE sum(dwell_clip) / count(*) END AS seg_dwell,
  avg(exp_seg) AS seg_exp,
  avg(CASE WHEN travel_sec <= benchmark_sec THEN 100.0 ELSE 0.0 END) FILTER (WHERE benchmark_sec IS NOT NULL)
    AS on_time_pct,
  avg(abs(steady_delta - steady_median)) AS steadiness_sec,
  sum(distance_mi) AS miles,
  avg(occ) AS crowd_load_pct,
  count(DISTINCT route_id) AS routes,
  list(DISTINCT service_date) AS days
FROM clipped JOIN own USING ({keys}) GROUP BY {keys} ORDER BY {keys}
"""


_PER_CAR = _per("number")
_PER_ROUTE_CAR = _per("route_id, number")

# A route's data days: days any bus ran it in the window, so Games Played on a route ignores days it didn't run.
_ROUTE_DAYS = "SELECT route_id, list(DISTINCT service_date ORDER BY service_date) FROM car_seg GROUP BY route_id"

_GAME_LOG = """
SELECT number, service_date, count(DISTINCT trip_id), sum(distance_mi), avg(seg_delta), list(DISTINCT route_id ORDER BY route_id)
FROM car_seg GROUP BY number, service_date ORDER BY number, service_date
"""

# Median segments per trip, counted before cars are unnest so a multi-car train is one trip.
_SEGS_PER_TRIP = """
SELECT median(n) FROM (
  SELECT count(*) AS n FROM read_parquet($1) WHERE service_date BETWEEN $2 AND $3 GROUP BY service_date, trip_id
)
"""
_SEGS_PER_TRIP_ROUTE = """
SELECT route_id, median(n) FROM (
  SELECT route_id, count(*) AS n FROM read_parquet($1) WHERE service_date BETWEEN $2 AND $3
  GROUP BY route_id, service_date, trip_id
) GROUP BY route_id
"""


def _per_trip(row: dict, spt: float) -> dict:
    """Replace a row's per-segment means with per-trip values (None stays None)."""
    def scale(v):
        return None if v is None else v * spt

    return {
        "trip_time_sec": scale(row.pop("seg_trip")),
        "travel_time_sec": scale(row.pop("seg_travel")),
        "dwell_time_sec": scale(row.pop("seg_dwell")),
        "exp_trip_sec": scale(row.pop("seg_exp")),
        "segs_per_trip": spt,
    }


# Co-occurrence counted per trip, not per segment.
_TEAMMATES = """
WITH ct AS (SELECT DISTINCT service_date, trip_id, number FROM car_seg)
SELECT a.number, b.number, count(*) AS n
FROM ct a JOIN ct b USING (service_date, trip_id)
WHERE a.number <> b.number
GROUP BY a.number, b.number
ORDER BY a.number, n DESC, b.number
"""


_LAST_SEEN = """
SELECT number, max(service_date) FROM (
  SELECT service_date, unnest(list_transform(cars, lambda c: __NUMBER__)) AS number FROM read_parquet($1)
) GROUP BY number
"""


def last_seen(root: Path, group: str) -> dict[str, str]:
    """Each vehicle's latest service date across every segment on disk, not just one window."""
    if not any((Path(root) / "segments" / group).glob("*/*.parquet")):
        return {}
    number = "coalesce(CAST(TRY_CAST(c AS BIGINT) AS VARCHAR), c)" if group == "bus" else "c"
    with duckdb.connect() as con:
        rows = con.execute(_LAST_SEEN.replace("__NUMBER__", number), [segment_glob(root, group)]).fetchall()
    return {n: str(d) for n, d in rows}


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
        spt = con.execute(_SEGS_PER_TRIP, args).fetchone()[0]
        route_spt = dict(con.execute(_SEGS_PER_TRIP_ROUTE, args).fetchall()) if is_bus else {}
        con.execute(_CAR_SEG.replace("__NUMBER__", _BUS_NUMBER if is_bus else "cars[i]"), args)
        per_car = con.execute(_PER_CAR)
        cols = [c[0] for c in per_car.description]
        cars = [dict(zip(cols, r)) for r in per_car.fetchall()]
        logs: dict[str, list[dict]] = {}
        for number, day, trips, miles, seg_trip, routes in con.execute(_GAME_LOG).fetchall():
            logs.setdefault(number, []).append(
                {"date": day, "trips": trips, "miles": None if is_bus else miles,
                 "trip_time_sec": None if seg_trip is None else seg_trip * spt, "routes": routes}
            )
        by_route: dict[str, list[dict]] = {}
        if is_bus:
            route_days = dict(con.execute(_ROUTE_DAYS).fetchall())
            per_route = con.execute(_PER_ROUTE_CAR)
            rcols = [c[0] for c in per_route.description]
            for r in per_route.fetchall():
                row = dict(zip(rcols, r))
                route, number, days = row.pop("route_id"), row.pop("number"), set(row.pop("days"))
                row.pop("routes")
                row.update(_per_trip(row, route_spt[route]))
                route_data_days = route_days[route]
                by_route.setdefault(number, []).append(
                    {
                        "route": route,
                        **row,
                        "qualified": row["trips"] >= ROUTE_QUALIFY_MIN_TRIPS,
                        "miles": None,
                        "games_played_pct": 100.0 * len(days) / len(route_data_days),
                        "iron_horse_days": _iron_horse(days, route_data_days),
                    }
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
        c.update(_per_trip(c, spt))
        out.append(
            {
                "car_id": f"{group}:{number}",
                "number": number,
                **c,
                "qualified": c["trips"] >= threshold,
                "miles": None if is_bus else c["miles"],
                "games_played_pct": 100.0 * len(days) / len(data_days),
                "iron_horse_days": _iron_horse(days, data_days),
                "teammates": mates.get(number, []),
                "routes": routes if is_bus else None,
                "game_log": logs.get(number, []),
                **({"by_route": by_route.get(number, [])} if is_bus else {}),
            }
        )
    return out
