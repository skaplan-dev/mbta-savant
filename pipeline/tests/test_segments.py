from datetime import date, datetime
from zoneinfo import ZoneInfo

import duckdb
import pytest

from savant import segments

ET = ZoneInfo("America/New_York")


def _seg(**kw):
    s = {"service_date": "2024-05-01", "group": "orange", "route_id": "Orange", "direction": 0,
         "trip_id": "t1", "from_stop": "70036", "to_stop": "70034", "dep_time": "2024-05-01T07:58:02-04:00",
         "hour_bucket": "am_peak", "day_type": "weekday", "travel_sec": 60.0, "dwell_sec": 20.0,
         "benchmark_sec": 60.0, "distance_mi": 1.1, "cars": ["1402", "1403"], "occupancy_pct": [4.0, None]}
    return {**s, **kw}


@pytest.mark.parametrize(
    "hh,mm,bucket",
    [(5, 59, "early"), (6, 0, "am_peak"), (8, 59, "am_peak"), (9, 0, "midday"), (14, 59, "midday"),
     (15, 0, "pm_peak"), (18, 59, "pm_peak"), (19, 0, "evening"), (21, 59, "evening"), (22, 0, "night"),
     (0, 30, "early")],
)
def test_hour_bucket(hh, mm, bucket):
    assert segments.hour_bucket(datetime(2024, 5, 1, hh, mm, tzinfo=ET)) == bucket


def test_day_type():
    assert segments.day_type(date(2024, 5, 1)) == "weekday"
    assert segments.day_type(date(2024, 5, 3)) == "weekday"
    assert segments.day_type(date(2024, 5, 4)) == "saturday"
    assert segments.day_type(date(2024, 5, 5)) == "sunday"


def test_parse_occupancy():
    assert segments.parse_occupancy("4.0|2.0||3.0") == [4.0, 2.0, None, 3.0]
    assert segments.parse_occupancy("") == []
    assert segments.parse_occupancy(None) == []


def test_write_day_empty_returns_none(tmp_path):
    assert segments.write_day([], tmp_path, "orange", date(2024, 5, 1)) is None
    assert list(tmp_path.rglob("*")) == []


def test_write_day_round_trip(tmp_path):
    segs = [_seg(), _seg(trip_id="t2", dep_time="2024-05-01T08:10:00-04:00", dwell_sec=None,
                     cars=["3901", "3850"], occupancy_pct=[])]
    path = segments.write_day(segs, tmp_path, "orange", date(2024, 5, 1))
    assert path == tmp_path / "segments" / "orange" / "2024" / "2024-05-01.parquet"
    assert path.exists()
    rel = duckdb.sql(f"select * from read_parquet('{segments.segment_glob(tmp_path, 'orange')}') order by dep_time")
    assert rel.columns == [
        "service_date", "group", "route_id", "direction", "trip_id", "from_stop", "to_stop", "dep_time",
        "hour_bucket", "day_type", "travel_sec", "dwell_sec", "benchmark_sec", "distance_mi", "cars",
        "occupancy_pct",
    ]
    types = dict(zip(rel.columns, (str(t) for t in rel.types)))
    assert types["cars"] == "VARCHAR[]"
    assert types["occupancy_pct"] == "DOUBLE[]"
    assert types["direction"] == "INTEGER"
    got = [dict(zip(rel.columns, r)) for r in rel.fetchall()]
    assert len(got) == 2
    first = got[0]
    assert first["cars"] == ["1402", "1403"]
    assert first["occupancy_pct"] == [4.0, None]
    assert first["dep_time"] == "2024-05-01T07:58:02-04:00"
    assert got[-1]["dwell_sec"] is None
    assert got[-1]["cars"] == ["3901", "3850"]
    assert got[-1]["occupancy_pct"] == []
    # leaves no temp files behind
    assert sorted(p.name for p in path.parent.iterdir()) == ["2024-05-01.parquet"]


def test_cars_for_prefers_consist_then_label():
    assert segments.cars_for({"vehicle_consist": "1402|1403", "vehicle_label": "1402"}) == ["1402", "1403"]
    assert segments.cars_for({"vehicle_consist": "", "vehicle_label": "3901-3850"}) == ["3901", "3850"]
    assert segments.cars_for({"vehicle_consist": None, "vehicle_label": None}) == []


def test_clean_cars_drops_junk_with_its_occupancy():
    assert segments.clean_cars("orange", ["3901", "WIRE", "0042"], [1.0, 2.0, 3.0]) == (["3901", "0042"], [1.0, 3.0])
    assert segments.clean_cars("orange", ["WIRE", "None"], []) == ([], [])


def test_clean_cars_normalizes_bus_numbers_only():
    assert segments.clean_cars("bus", ["0952"], []) == (["952"], [])
    assert segments.clean_cars("blue", ["0700", "0701"], []) == (["0700", "0701"], [])


def test_unicode_digit_car_tokens_dropped():
    assert segments.clean_cars("orange", ["3901", "\u00b2", "0042"], []) == (["3901", "0042"], [])


@pytest.mark.parametrize(
    "group,route,ok",
    [("orange", "Orange", True), ("orange", "Red", False), ("green", "Green-B", True),
     ("mattapan", "Red", False), ("orange", "34E", False), ("bus", "34E", True), ("bus", "28", True),
     ("bus", "Red", False), ("bus", "CR-Fitchburg", False), ("bus", "Boat-F1", False)],
)
def test_belongs(group, route, ok):
    assert segments.belongs(group, route) is ok
