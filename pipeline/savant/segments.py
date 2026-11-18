"""Trip segments: one row per (trip, consecutive stop pair), stored as Parquet per group per day.

Segments are built from the MBTA's public LAMP files in ``savant.lamp``; this module holds the shared
row helpers and the on-disk format.
"""

import json
import math
import os
import tempfile
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import duckdb

from savant.groups import group_for_route

EASTERN = ZoneInfo("America/New_York")
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


def clean_cars(
    group: str, cars: list[str], occupancy: list[float | None]
) -> tuple[list[str], list[float | None]]:
    """Keep all-digit car tokens only (junk like WIRE/None is dropped), with occupancy at the same indexes.

    Bus numbers are normalized (``0952`` -> ``952``) since the feed reports both forms; rail tokens are kept as-is.
    """
    keep = [i for i, c in enumerate(cars) if c.isascii() and c.isdigit()]
    kept = [str(int(cars[i])) if group == "bus" else cars[i] for i in keep]
    if not occupancy:
        return kept, []
    return kept, [occupancy[i] for i in keep if i < len(occupancy)]


_NOT_BUS_PREFIXES = ("CR-", "Boat-", "CapeFlyer")


def belongs(group: str, route_id: str) -> bool:
    """Rail groups need an exact route match. Bus keeps any route not claimed by rail, Commuter Rail or ferry,
    so routes missing from bus_constants (e.g. 34E, 708) are not silently dropped."""
    g = group_for_route(route_id)
    if group != "bus":
        return g == group
    return g in (None, "bus") and not route_id.startswith(_NOT_BUS_PREFIXES)


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
