import csv
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import duckdb
import pytest

from savant import segments

FIXTURE = Path(__file__).parent / "fixtures" / "orange_day.csv"
ET = ZoneInfo("America/New_York")
TRIP1 = "62468110"
TRIP2 = "62468244"


def _rows():
    with FIXTURE.open() as f:
        return list(csv.DictReader(f))


@pytest.fixture
def segs():
    return segments.build_segments("orange", _rows())


def _by(segs, trip_id, from_stop):
    (seg,) = [s for s in segs if s["trip_id"] == trip_id and s["from_stop"] == from_stop]
    return seg


def test_fixture_yields_six_segments(segs):
    assert len(segs) == 6
    assert [(s["trip_id"], s["from_stop"], s["to_stop"]) for s in segs] == [
        (TRIP1, "70036", "70034"),
        (TRIP1, "70034", "70032"),
        (TRIP1, "70032", "70278"),
        (TRIP2, "70036", "70034"),
        (TRIP2, "70034", "70032"),
        (TRIP2, "70032", "70278"),
    ]


def test_consist_split_into_cars(segs):
    for s in segs:
        if s["trip_id"] == TRIP1:
            assert s["cars"] == ["1402", "1403", "1404", "1405", "1406", "1407"]


def test_green_label_fallback_when_consist_empty(segs):
    for s in segs:
        if s["trip_id"] == TRIP2:
            assert s["cars"] == ["3901", "3850"]
            assert s["occupancy_pct"] == []


def test_skips_rows_without_trip_id():
    rows = _rows()
    assert any(r["trip_id"] == "" for r in rows)
    segs = segments.build_segments("orange", rows)
    assert all(s["trip_id"] for s in segs)
    # a lone no-trip row on its own yields nothing (it would otherwise group under "")
    lone = [r for r in rows if r["trip_id"] == ""]
    dep = dict(lone[0], event_type="DEP", stop_id="70036", event_time="2024-05-01 11:58:00-04:00")
    assert segments.build_segments("orange", [dep, *lone]) == []


def test_ignores_predicted_events(segs):
    # the PRA at Assembly (08:06:00) must not stand in for the real ARR (08:06:30)
    assert _by(segs, TRIP1, "70032")["travel_sec"] == 90.0


def test_travel_dwell_and_rearrival(segs):
    first = _by(segs, TRIP1, "70036")
    assert first["travel_sec"] == 98.0
    assert first["dwell_sec"] == 35.0
    # Wellington: ARR 08:03:05, DEP 08:03:50, re-ARR 08:04:20 (30 s later, same stop), DEP 08:05:00
    mid = _by(segs, TRIP1, "70034")
    assert mid["travel_sec"] == 170.0
    assert mid["dwell_sec"] == 115.0
    last = _by(segs, TRIP1, "70032")
    assert last["dep_time"] == "2024-05-01T08:05:00-04:00"
    assert last["dwell_sec"] is None


def test_segment_fields(segs):
    s = _by(segs, TRIP1, "70036")
    assert s["service_date"] == "2024-05-01"
    assert s["group"] == "orange"
    assert s["route_id"] == "Orange"
    assert s["direction"] == 0
    assert s["dep_time"] == "2024-05-01T07:58:02-04:00"
    assert s["hour_bucket"] == "am_peak"
    assert s["day_type"] == "weekday"
    assert s["benchmark_sec"] == 120.0
    assert s["distance_mi"] == pytest.approx(0.7346, abs=1e-3)
    t2 = _by(segs, TRIP2, "70036")
    assert t2["hour_bucket"] == "pm_peak"
    assert t2["benchmark_sec"] is None
    # naive event_time is Eastern
    assert t2["dep_time"] == "2024-05-01T17:20:00-04:00"


def test_occupancy_from_departure_row(segs):
    assert _by(segs, TRIP1, "70036")["occupancy_pct"] == [4.0, 2.0, 3.0, 5.0, None, 1.0]
    assert _by(segs, TRIP1, "70032")["occupancy_pct"] == [20.0, 22.0, 18.0, 19.5, 21.0, 17.0]


def test_non_positive_travel_dropped():
    rows = [r for r in _rows() if r["trip_id"] == TRIP2]
    for r in rows:
        if r["stop_id"] == "70034" and r["event_type"] == "ARR":
            r["event_time"] = "2024-05-01T17:20:00-04:00"  # same instant as Oak Grove DEP
    segs = segments.build_segments("orange", rows)
    assert [(s["from_stop"], s["to_stop"]) for s in segs] == [("70034", "70032"), ("70032", "70278")]


def test_bus_has_no_distance():
    rows = [
        {"service_date": "2024-05-04", "route_id": "28", "trip_id": "t1", "direction_id": "1",
         "stop_id": "28-1-1728", "vehicle_label": "1234", "vehicle_consist": "", "event_type": "DEP",
         "event_time": "2024-05-04 23:10:00-04:00", "scheduled_tt": "", "occupancy_percentage": ""},
        {"service_date": "2024-05-04", "route_id": "28", "trip_id": "t1", "direction_id": "1",
         "stop_id": "28-1-1729", "vehicle_label": "1234", "vehicle_consist": "", "event_type": "ARR",
         "event_time": "2024-05-04 23:13:00-04:00", "scheduled_tt": "", "occupancy_percentage": ""},
    ]
    (s,) = segments.build_segments("bus", rows)
    assert s["distance_mi"] is None
    assert s["cars"] == ["1234"]
    assert s["day_type"] == "saturday"
    assert s["hour_bucket"] == "night"


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


def test_write_day_round_trip(tmp_path, segs):
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
    assert len(got) == 6
    first = got[0]
    assert first["cars"] == ["1402", "1403", "1404", "1405", "1406", "1407"]
    assert first["occupancy_pct"] == [4.0, 2.0, 3.0, 5.0, None, 1.0]
    assert first["dep_time"] == "2024-05-01T07:58:02-04:00"
    assert got[2]["dwell_sec"] is None
    assert got[-1]["cars"] == ["3901", "3850"]
    assert got[-1]["occupancy_pct"] == []
    # leaves no temp files behind
    assert sorted(p.name for p in path.parent.iterdir()) == ["2024-05-01.parquet"]


def _ev(stop, etype, t, **kw):
    row = {"service_date": "2024-05-01", "route_id": "Orange", "trip_id": "t9", "direction_id": "0",
           "stop_id": stop, "vehicle_label": "1402", "vehicle_consist": "", "event_type": etype,
           "event_time": f"2024-05-01 {t}-04:00", "scheduled_tt": "", "occupancy_percentage": ""}
    row.update(kw)
    return row


def test_same_second_arr_sorts_before_dep():
    rows = [
        _ev("70036", "DEP", "08:00:00"),
        _ev("70034", "DEP", "08:02:00"),
        _ev("70034", "ARR", "08:02:00"),
        _ev("70032", "ARR", "08:04:00"),
    ]
    segs = segments.build_segments("orange", rows)
    assert [(s["from_stop"], s["to_stop"]) for s in segs] == [("70036", "70034"), ("70034", "70032")]


def test_benchmark_falls_back_to_scheduled_travel_time():
    rows = [
        _ev("70036", "DEP", "08:00:00", scheduled_tt=None, scheduled_travel_time="0"),
        _ev("70034", "ARR", "08:02:00", scheduled_tt=None, scheduled_travel_time="110"),
    ]
    for r in rows:
        del r["scheduled_tt"]
    (s,) = segments.build_segments("orange", rows)
    assert s["benchmark_sec"] == 110.0


@pytest.mark.parametrize("bad", ["", None])
def test_bad_direction_skips_segment_only(bad):
    rows = [
        _ev("70036", "DEP", "08:00:00", direction_id=bad),
        _ev("70034", "ARR", "08:02:00"),
        _ev("70034", "DEP", "08:02:30"),
        _ev("70032", "ARR", "08:04:00"),
    ]
    if bad is None:
        del rows[0]["direction_id"]
    segs = segments.build_segments("orange", rows)
    assert [(s["from_stop"], s["to_stop"]) for s in segs] == [("70034", "70032")]


def test_route_outside_group_dropped():
    rows = _rows()
    for r in rows:
        r["route_id"] = "Red"
    assert segments.build_segments("mattapan", rows) == []
    assert segments.build_segments("orange", rows) == []


def test_non_numeric_car_tokens_removed_with_occupancy():
    rows = [r for r in _rows() if r["trip_id"] == TRIP1]
    for r in rows:
        r["vehicle_consist"] = "3901|WIRE|0042"
        r["occupancy_percentage"] = "1|2|3"
    segs = segments.build_segments("orange", rows)
    assert segs and all(s["cars"] == ["3901", "0042"] for s in segs)
    assert all(s["occupancy_pct"] == [1.0, 3.0] for s in segs)


def test_segment_with_no_numeric_cars_dropped():
    rows = [r for r in _rows() if r["trip_id"] == TRIP1]
    for r in rows:
        r["vehicle_consist"] = "WIRE|None"
    assert segments.build_segments("orange", rows) == []


def _bus_rows(route_id, label="1234"):
    return [
        {"service_date": "2024-05-04", "route_id": route_id, "trip_id": "t1", "direction_id": "1",
         "stop_id": "1728", "vehicle_label": label, "vehicle_consist": "", "event_type": "DEP",
         "event_time": "2024-05-04 23:10:00-04:00", "scheduled_tt": "", "occupancy_percentage": ""},
        {"service_date": "2024-05-04", "route_id": route_id, "trip_id": "t1", "direction_id": "1",
         "stop_id": "1729", "vehicle_label": label, "vehicle_consist": "", "event_type": "ARR",
         "event_time": "2024-05-04 23:13:00-04:00", "scheduled_tt": "", "occupancy_percentage": ""},
    ]


@pytest.mark.parametrize("route", ["34E", "708", "28"])
def test_bus_keeps_unmapped_routes(route):
    (s,) = segments.build_segments("bus", _bus_rows(route))
    assert s["route_id"] == route


@pytest.mark.parametrize("route", ["Red", "Mattapan", "Green-B", "CR-Fitchburg", "Boat-F1", "CapeFlyer"])
def test_bus_drops_rail_cr_and_boat_routes(route):
    assert segments.build_segments("bus", _bus_rows(route)) == []


def test_rail_groups_still_strict():
    rows = _rows()
    for r in rows:
        r["route_id"] = "34E"
    assert segments.build_segments("orange", rows) == []


def test_bus_numbers_normalized():
    (s,) = segments.build_segments("bus", _bus_rows("28", "0952"))
    assert s["cars"] == ["952"]


def test_rail_numbers_untouched():
    rows = [r for r in _rows() if r["trip_id"] == TRIP1]
    for r in rows:
        r["route_id"] = "Blue"
        r["vehicle_consist"] = "0700|0701"
    segs = segments.build_segments("blue", rows)
    assert segs and all(s["cars"] == ["0700", "0701"] for s in segs)


def test_unicode_digit_car_tokens_dropped():
    assert segments._clean_cars("orange", ["3901", "\u00b2", "0042"], []) == (["3901", "0042"], [])
