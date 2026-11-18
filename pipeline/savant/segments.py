"""Trip segments: one row per (trip, consecutive stop pair), stored as Parquet per group per day.

Pairing follows TransitMatters' t-performance-dash (v5 ``s3_historical``): events are matched on
``(service_date, trip_id)``, a stop's DEP pairs with the next stop's ARR, and the benchmark is the
difference of ``scheduled_tt`` between the two stops.
"""

import json
import math
import os
import tempfile
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import duckdb

from savant.groups import distance_miles, group_for_route, station_for_stop

EASTERN = ZoneInfo("America/New_York")
ARRIVAL = "ARR"
DEPARTURE = "DEP"

# A train recorded arriving again this soon after it departed is still making the same stop, e.g. a
# Park St train moving up a berth (from v5).
SAME_STOP_REARRIVAL_SEC = 60

COLUMNS: dict[str, str] = {
    "service_date": "VARCHAR",
    "group": "VARCHAR",
    "route_id": "VARCHAR",
    "direction": "INTEGER",
    "trip_id": "VARCHAR",
    "from_stop": "VARCHAR",
    "to_stop": "VARCHAR",
    "dep_time": "VARCHAR",
    "hour_bucket": "VARCHAR",
    "day_type": "VARCHAR",
    "travel_sec": "DOUBLE",
    "dwell_sec": "DOUBLE",
    "benchmark_sec": "DOUBLE",
    "distance_mi": "DOUBLE",
    "cars": "VARCHAR[]",
    "occupancy_pct": "DOUBLE[]",
}


def parse_event_time(s: str) -> datetime:
    """Event timestamp -> aware datetime; a timestamp without an offset is Eastern (as v5)."""
    dt = datetime.fromisoformat(s)
    return dt.replace(tzinfo=EASTERN) if dt.tzinfo is None else dt


def hour_bucket(dt: datetime) -> str:
    h = dt.astimezone(EASTERN).hour if dt.tzinfo is not None else dt.hour
    if h < 6:
        return "early"
    if h < 9:
        return "am_peak"
    if h < 15:
        return "midday"
    if h < 19:
        return "pm_peak"
    if h < 22:
        return "evening"
    return "night"


def day_type(service_date: date) -> str:
    wd = service_date.weekday()
    return "saturday" if wd == 5 else "sunday" if wd == 6 else "weekday"


def cars_for(row: dict) -> list[str]:
    consist = (row.get("vehicle_consist") or "").strip()
    if consist:
        return [c for c in consist.split("|") if c]
    label = (row.get("vehicle_label") or "").strip()
    return [c for c in label.split("-") if c] if label else []


def parse_occupancy(value: str | None) -> list[float | None]:
    if not value:
        return []
    out: list[float | None] = []
    for part in value.split("|"):
        try:
            f = float(part)
            out.append(None if math.isnan(f) or math.isinf(f) else f)
        except ValueError:
            out.append(None)
    return out


def _clean_cars(
    group: str, cars: list[str], occupancy: list[float | None]
) -> tuple[list[str], list[float | None]]:
    """Keep all-digit car tokens only (junk like WIRE/None is dropped), with occupancy at the same indexes.

    Bus numbers are normalized (``0952`` -> ``952``) since the feed reports both forms; rail tokens are kept as-is.
    """
    keep = [i for i, c in enumerate(cars) if c.isdigit()]
    kept = [str(int(cars[i])) if group == "bus" else cars[i] for i in keep]
    if not occupancy:
        return kept, []
    return kept, [occupancy[i] for i in keep if i < len(occupancy)]


def _benchmark(dep: dict, arr: dict) -> float | None:
    try:
        # older monthly archives only carry scheduled_travel_time (v5 fallback)
        b = float(_sched(arr)) - float(_sched(dep))
    except (TypeError, ValueError):
        return None
    if math.isnan(b) or math.isinf(b) or b < 1:
        return None
    return b


def _sched(row: dict):
    return row.get("scheduled_tt") or row.get("scheduled_travel_time")


def _place(stop_id: str) -> str:
    return station_for_stop(stop_id) or stop_id


class _Stop:
    __slots__ = ("place", "arrival", "departure", "arr_dt", "dep_dt", "at_station")

    def __init__(self, place):
        self.place = place
        self.arrival = self.departure = self.arr_dt = self.dep_dt = None
        self.at_station = False


def _trip_stops(events: list[tuple[datetime, dict]]) -> list[_Stop]:
    stops: list[_Stop] = []
    for dt, ev in events:
        place = _place(ev["stop_id"])
        cur = stops[-1] if stops else None
        same = cur is not None and cur.place == place
        if ev["event_type"] == ARRIVAL:
            if same and (
                cur.at_station
                or (cur.dep_dt is not None and (dt - cur.dep_dt).total_seconds() <= SAME_STOP_REARRIVAL_SEC)
            ):
                cur.at_station = True
                continue
            stop = _Stop(place)
            stop.arrival, stop.arr_dt, stop.at_station = ev, dt, True
            stops.append(stop)
        else:
            if same and cur.at_station:
                stop = cur
            else:
                # departure with no recorded arrival (e.g. the trip's first terminal)
                stop = _Stop(place)
                stops.append(stop)
            stop.departure, stop.dep_dt, stop.at_station = ev, dt, False
    return stops


_NOT_BUS_PREFIXES = ("CR-", "Boat-", "CapeFlyer")


def _belongs(group: str, route_id: str) -> bool:
    """Rail groups need an exact route match. Bus keeps any route not claimed by rail, Commuter Rail or ferry,
    so routes missing from bus_constants (e.g. 34E, 708) are not silently dropped."""
    g = group_for_route(route_id)
    if group != "bus":
        return g == group
    return g in (None, "bus") and not route_id.startswith(_NOT_BUS_PREFIXES)


def build_segments(group: str, rows: list[dict]) -> list[dict]:
    trips: dict[tuple[str, str], list[tuple[datetime, dict]]] = defaultdict(list)
    for r in rows:
        if not r.get("trip_id") or r.get("event_type") not in (ARRIVAL, DEPARTURE):
            continue
        trips[(r["service_date"], r["trip_id"])].append((parse_event_time(r["event_time"]), r))

    out: list[dict] = []
    for (service_date, trip_id), events in trips.items():
        # at equal timestamps an ARR comes before the same stop's DEP
        events.sort(key=lambda e: (e[0], e[1]["event_type"] != ARRIVAL))
        sd = date.fromisoformat(service_date)
        stops = _trip_stops(events)
        for a, b in zip(stops, stops[1:]):
            if a.departure is None or b.arrival is None:
                continue
            travel = (b.arr_dt - a.dep_dt).total_seconds()
            if travel <= 0:
                continue
            dep = a.departure
            try:
                direction = int(dep.get("direction_id"))
            except (TypeError, ValueError):
                continue  # one bad row must not fail the whole day
            if not _belongs(group, dep["route_id"]):
                continue
            cars, occupancy = _clean_cars(group, cars_for(dep), parse_occupancy(dep.get("occupancy_percentage")))
            if not cars:
                continue
            from_station, to_station = station_for_stop(dep["stop_id"]), station_for_stop(b.arrival["stop_id"])
            distance = distance_miles(from_station, to_station) if from_station and to_station else None
            out.append(
                {
                    "service_date": service_date,
                    "group": group,
                    "route_id": dep["route_id"],
                    "direction": direction,
                    "trip_id": trip_id,
                    "from_stop": dep["stop_id"],
                    "to_stop": b.arrival["stop_id"],
                    "dep_time": a.dep_dt.astimezone(EASTERN).isoformat(),
                    "hour_bucket": hour_bucket(a.dep_dt),
                    "day_type": day_type(sd),
                    "travel_sec": travel,
                    "dwell_sec": (b.dep_dt - b.arr_dt).total_seconds() if b.dep_dt is not None else None,
                    "benchmark_sec": _benchmark(dep, b.arrival),
                    "distance_mi": distance,
                    "cars": cars,
                    "occupancy_pct": occupancy,
                }
            )
    out.sort(key=lambda s: (s["service_date"], s["trip_id"]))  # stable: chronological within a trip
    return out


def day_path(root: Path, group: str, day: date) -> Path:
    return Path(root) / "segments" / group / f"{day.year:04d}" / f"{day.isoformat()}.parquet"


def segment_glob(root: Path, group: str) -> str:
    return str(Path(root) / "segments" / group / "*" / "*.parquet")


def write_day(segments: list[dict], root: Path, group: str, day: date) -> Path | None:
    if not segments:
        return None
    path = day_path(root, group, day)
    path.parent.mkdir(parents=True, exist_ok=True)
    columns = ", ".join(f"'{k}': '{v}'" for k, v in COLUMNS.items())
    select = ", ".join(f'"{k}"' for k in COLUMNS)
    fd, tmp_json = tempfile.mkstemp(suffix=".jsonl", dir=path.parent, prefix=".tmp-")
    tmp_parquet = path.with_name(f".tmp-{path.name}")
    try:
        with os.fdopen(fd, "w") as f:
            for s in segments:
                f.write(json.dumps({k: s[k] for k in COLUMNS}))
                f.write("\n")
        con = duckdb.connect()
        try:
            con.execute(
                f"COPY (SELECT {select} FROM read_json(?, format='newline_delimited', columns={{{columns}}})) "
                f"TO '{_sql_str(tmp_parquet)}' (FORMAT PARQUET)",
                [tmp_json],
            )
        finally:
            con.close()
        os.replace(tmp_parquet, path)
    finally:
        Path(tmp_json).unlink(missing_ok=True)
        tmp_parquet.unlink(missing_ok=True)
    return path


def _sql_str(p: Path) -> str:
    return str(p).replace("'", "''")
