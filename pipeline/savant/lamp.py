"""Trip segments from the MBTA's public LAMP files (https://performancedata.mbta.com), no credentials needed.

Subway: one Parquet file per service date. Each row is a trip's stop with the departure from the
previous stop (``move_timestamp``, epoch seconds), the arrival here (``stop_timestamp``) and LAMP's own
``travel_time_seconds``/``dwell_time_seconds``/``scheduled_travel_time``.

Bus: one Parquet file holding every day since late December 2025, one row group per service date, so a
filtered read fetches only that day. Times are naive Eastern datetimes; travel is computed from the last
stop on the trip that has a departure.

Either way a segment runs between consecutive recorded stops of one trip and vehicle, as before.
"""

import math
from datetime import date, datetime

import duckdb

from savant.groups import distance_miles, station_for_stop
from savant.segments import EASTERN, belongs, cars_for, clean_cars, day_type, hour_bucket, parse_occupancy

BASE = "https://performancedata.mbta.com/lamp"
RAIL_URL = BASE + "/subway-on-time-performance-v1/{day}-subway-on-time-performance-v1.parquet"
BUS_URL = BASE + "/tableau/bus/LAMP_ALL_Bus_Events.parquet"
RAIL_GROUPS = ("red", "orange", "blue", "green", "mattapan")

_RAIL_SQL = """
SELECT * FROM (
  SELECT route_id, CAST(direction_id AS INTEGER) AS direction, trip_id,
    lag(stop_id) OVER w AS from_stop, stop_id AS to_stop, move_timestamp AS dep_ts,
    travel_time_seconds AS travel, dwell_time_seconds AS dwell, scheduled_travel_time AS bench,
    vehicle_consist, vehicle_label, occupancy_percentage
  FROM read_parquet(?)
  WINDOW w AS (PARTITION BY trip_id, vehicle_id ORDER BY stop_sequence)
)
WHERE from_stop IS NOT NULL AND dep_ts IS NOT NULL AND travel > 0
"""

_BUS_SQL = """
SELECT * FROM (
  SELECT route_id, CAST(direction_id AS INTEGER) AS direction, trip_id, vehicle_label,
    lag(stop_id) OVER w AS from_stop, stop_id AS to_stop, lag(stop_departure_dt) OVER w AS dep_dt,
    date_diff('second', lag(stop_departure_dt) OVER w, stop_arrival_dt) AS travel,
    stopped_duration_seconds AS dwell,
    -- the schedule's travel time is from the previous scheduled stop; only trust it with no gap
    CASE WHEN lag(stop_sequence) OVER w = stop_sequence - 1 THEN plan_travel_time_seconds END AS bench
  FROM read_parquet(?)
  WHERE service_date = ? AND stop_arrival_dt IS NOT NULL AND stop_departure_dt IS NOT NULL
  WINDOW w AS (PARTITION BY trip_id, vehicle_label ORDER BY stop_sequence)
)
WHERE from_stop IS NOT NULL AND travel > 0
"""


def _connect() -> duckdb.DuckDBPyConnection:
    con = duckdb.connect()
    con.execute("SET http_retries = 5")
    return con


def _query(sql: str, params: list) -> list[dict] | None:
    """Rows as dicts, or None when the file doesn't exist (a day LAMP hasn't published)."""
    con = _connect()
    try:
        cur = con.execute(sql, params)
        cols = [c[0] for c in cur.description]
        return [dict(zip(cols, r)) for r in cur.fetchall()]
    except duckdb.IOException as ex:
        if "404" in str(ex) or "No files found" in str(ex):
            return None
        raise
    finally:
        con.close()


def _seconds(v) -> float | None:
    if v is None:
        return None
    f = float(v)
    return None if math.isnan(f) or math.isinf(f) else f


def _benchmark(v) -> float | None:
    b = _seconds(v)
    return b if b is not None and b >= 1 else None


def _segment(group: str, day: date, r: dict, dep: datetime, cars: list[str], occupancy: list) -> dict | None:
    cars, occupancy = clean_cars(group, cars, occupancy)
    if not cars or r["direction"] is None:
        return None
    a, b = station_for_stop(r["from_stop"]), station_for_stop(r["to_stop"])
    return {
        "service_date": day.isoformat(),
        "group": group,
        "route_id": r["route_id"],
        "direction": int(r["direction"]),
        "trip_id": r["trip_id"],
        "from_stop": r["from_stop"],
        "to_stop": r["to_stop"],
        "dep_time": dep.isoformat(),
        "hour_bucket": hour_bucket(dep),
        "day_type": day_type(day),
        "travel_sec": float(r["travel"]),
        "dwell_sec": _seconds(r["dwell"]),
        "benchmark_sec": _benchmark(r["bench"]),
        "distance_mi": distance_miles(a, b) if a and b else None,
        "cars": cars,
        "occupancy_pct": occupancy,
    }


def rail_segments(day: date, groups: list[str], url: str | None = None) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {g: [] for g in groups}
    rows = _query(_RAIL_SQL, [url or RAIL_URL.format(day=day.isoformat())]) or []
    for r in rows:
        group = next((g for g in groups if belongs(g, r["route_id"])), None)
        if group is None:
            continue
        dep = datetime.fromtimestamp(r["dep_ts"], EASTERN)
        s = _segment(group, day, r, dep, cars_for(r), parse_occupancy(r["occupancy_percentage"]))
        if s:
            out[group].append(s)
    return out


def bus_segments(day: date, url: str | None = None) -> list[dict]:
    rows = _query(_BUS_SQL, [url or BUS_URL, day]) or []
    out = []
    for r in rows:
        if not belongs("bus", r["route_id"]):
            continue
        s = _segment("bus", day, r, r["dep_dt"].replace(tzinfo=EASTERN), [r["vehicle_label"] or ""], [])
        if s:
            out.append(s)
    return out


def day_segments(day: date, groups: list[str]) -> dict[str, list[dict]]:
    """Segments for each requested group, each list in (trip, departure) order."""
    out: dict[str, list[dict]] = {}
    rail = [g for g in groups if g in RAIL_GROUPS]
    if rail:
        out.update(rail_segments(day, rail))
    if "bus" in groups:
        out["bus"] = bus_segments(day)
    for segs in out.values():
        segs.sort(key=lambda s: (s["trip_id"], s["dep_time"]))
    return out
