"""Write small LAMP-shaped Parquet files for tests (only the columns savant.lamp reads)."""

from datetime import date, datetime
from pathlib import Path

import duckdb

RAIL_COLUMNS = {
    "route_id": "VARCHAR", "direction_id": "BOOLEAN", "trip_id": "VARCHAR", "vehicle_id": "VARCHAR",
    "stop_id": "VARCHAR", "stop_sequence": "SMALLINT", "move_timestamp": "BIGINT", "stop_timestamp": "BIGINT",
    "travel_time_seconds": "BIGINT", "dwell_time_seconds": "BIGINT", "scheduled_travel_time": "BIGINT",
    "vehicle_consist": "VARCHAR", "vehicle_label": "VARCHAR", "occupancy_percentage": "VARCHAR",
}

BUS_COLUMNS = {
    "service_date": "DATE", "route_id": "VARCHAR", "direction_id": "TINYINT", "trip_id": "VARCHAR",
    "vehicle_label": "VARCHAR", "stop_id": "VARCHAR", "stop_sequence": "UINTEGER",
    "stop_arrival_dt": "TIMESTAMP", "stop_departure_dt": "TIMESTAMP", "stopped_duration_seconds": "BIGINT",
    "plan_travel_time_seconds": "BIGINT",
}


def _write(path: Path, columns: dict[str, str], rows: list[dict]) -> Path:
    con = duckdb.connect()
    try:
        con.execute(f"CREATE TABLE t ({', '.join(f'{k} {v}' for k, v in columns.items())})")
        if rows:
            con.executemany(
                f"INSERT INTO t VALUES ({', '.join('?' for _ in columns)})",
                [[r.get(k) for k in columns] for r in rows],
            )
        con.execute(f"COPY t TO '{path}' (FORMAT PARQUET)")
    finally:
        con.close()
    return path


def rail_file(path: Path, rows: list[dict]) -> Path:
    return _write(path, RAIL_COLUMNS, rows)


def bus_file(path: Path, rows: list[dict]) -> Path:
    return _write(path, BUS_COLUMNS, rows)


def epoch(day: date, hh: int, mm: int, ss: int = 0) -> int:
    """Epoch seconds for an Eastern wall-clock time (EDT in the test dates)."""
    from savant.segments import EASTERN

    return int(datetime(day.year, day.month, day.day, hh, mm, ss, tzinfo=EASTERN).timestamp())


def rail_trip(day: date, trip: str, stops: list[str], *, route="Orange", consist="1402|1403",
              label="1402", occupancy="4.0|2.0", start=(8, 0), travel=60, dwell=20, sched=60,
              direction=False) -> list[dict]:
    """One trip: the first stop has only an arrival; each later stop is `travel` s after leaving the last."""
    t = epoch(day, *start)
    rows = [{"route_id": route, "direction_id": direction, "trip_id": trip, "vehicle_id": f"v-{label}",
             "stop_id": stops[0], "stop_sequence": 10, "move_timestamp": None, "stop_timestamp": t,
             "travel_time_seconds": None, "dwell_time_seconds": dwell, "scheduled_travel_time": None,
             "vehicle_consist": consist, "vehicle_label": label, "occupancy_percentage": occupancy}]
    for i, stop in enumerate(stops[1:], start=2):
        move = t + dwell
        t = move + travel
        rows.append({**rows[0], "stop_id": stop, "stop_sequence": 10 * i, "move_timestamp": move,
                     "stop_timestamp": t, "travel_time_seconds": travel, "dwell_time_seconds": dwell,
                     "scheduled_travel_time": sched})
    return rows


def bus_stop(day: date, trip: str, seq: int, stop: str, arr: tuple | None, dep: tuple | None, *,
             route="28", label="1234", direction=1, dwell=None, plan=60) -> dict:
    at = lambda hms: datetime(day.year, day.month, day.day, *hms) if hms else None  # noqa: E731
    return {"service_date": day, "route_id": route, "direction_id": direction, "trip_id": trip,
            "vehicle_label": label, "stop_id": stop, "stop_sequence": seq, "stop_arrival_dt": at(arr),
            "stop_departure_dt": at(dep), "stopped_duration_seconds": dwell, "plan_travel_time_seconds": plan}
