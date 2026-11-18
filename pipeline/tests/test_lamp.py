from datetime import date

import pytest

from savant import lamp
from lamp_data import bus_file, bus_stop, rail_file, rail_trip

D = date(2026, 5, 1)  # a Friday, EDT
ORANGE = ["70036", "70034", "70032"]  # Oak Grove -> Malden Center -> Wellington


def rail(tmp_path, rows, groups=("orange",)):
    return lamp.rail_segments(D, list(groups), url=str(rail_file(tmp_path / "rail.parquet", rows)))


def bus(tmp_path, rows):
    return lamp.bus_segments(D, url=str(bus_file(tmp_path / "bus.parquet", rows)))


def test_rail_segments_between_consecutive_stops(tmp_path):
    out = rail(tmp_path, rail_trip(D, "t1", ORANGE, travel=60, dwell=20, sched=60))
    a, b = out["orange"]
    assert (a["from_stop"], a["to_stop"]) == ("70036", "70034")
    assert (b["from_stop"], b["to_stop"]) == ("70034", "70032")
    assert a["travel_sec"] == 60.0 and a["dwell_sec"] == 20.0 and a["benchmark_sec"] == 60.0
    # left Oak Grove 20 s after an 08:00:00 arrival
    assert a["dep_time"] == "2026-05-01T08:00:20-04:00"
    assert a["hour_bucket"] == "am_peak" and a["day_type"] == "weekday"
    assert a["cars"] == ["1402", "1403"] and a["occupancy_pct"] == [4.0, 2.0]
    assert a["direction"] == 0 and a["route_id"] == "Orange" and a["service_date"] == "2026-05-01"
    assert a["distance_mi"] is not None and a["distance_mi"] > 0


def test_rail_rows_split_by_group(tmp_path):
    rows = rail_trip(D, "o", ORANGE) + rail_trip(D, "r", ["70061", "70063"], route="Red", consist="1500|1501")
    out = rail(tmp_path, rows, groups=("orange", "red", "blue"))
    assert len(out["orange"]) == 2 and len(out["red"]) == 1 and out["blue"] == []
    assert rail(tmp_path, rows, groups=("orange",)).keys() == {"orange"}


def test_green_branches_and_label_fallback(tmp_path):
    rows = rail_trip(D, "g", ["70200", "70196"], route="Green-B", consist="", label="3901-3850", occupancy="")
    (s,) = rail(tmp_path, rows, groups=("green",))["green"]
    assert s["cars"] == ["3901", "3850"] and s["occupancy_pct"] == []


def test_rail_drops_non_positive_travel_and_bad_schedule(tmp_path):
    rows = rail_trip(D, "t", ORANGE, sched=0)
    rows[2]["travel_time_seconds"] = 0
    (s,) = rail(tmp_path, rows)["orange"]
    assert s["to_stop"] == "70034" and s["benchmark_sec"] is None


def test_rail_occupancy_kept_aligned_when_tokens_dropped(tmp_path):
    rows = rail_trip(D, "t", ORANGE[:2], consist="1402|WIRE|1403", occupancy="|5.0|7.0")
    (s,) = rail(tmp_path, rows)["orange"]
    assert s["cars"] == ["1402", "1403"] and s["occupancy_pct"] == [None, 7.0]


def test_rail_vehicles_on_one_trip_are_separate(tmp_path):
    rows = rail_trip(D, "t", ORANGE[:2], label="1402") + rail_trip(D, "t", ORANGE[:2], label="1410", consist="1410")
    segs = rail(tmp_path, rows)["orange"]
    assert sorted(s["cars"][0] for s in segs) == ["1402", "1410"]


def test_missing_rail_day_is_empty(tmp_path):
    assert lamp.rail_segments(D, ["red"], url=str(tmp_path / "nope.parquet")) == {"red": []}


def test_bus_travel_from_last_departure_and_gap_drops_schedule(tmp_path):
    rows = [
        bus_stop(D, "b", 1, "64", (8, 0, 0), (8, 5, 0)),
        bus_stop(D, "b", 2, "1", (8, 5, 40), (8, 6, 0), dwell=20, plan=45),
        bus_stop(D, "b", 3, "2", None, None),
        bus_stop(D, "b", 4, "6", (8, 7, 30), (8, 7, 30), dwell=0, plan=60),
    ]
    a, b = bus(tmp_path, rows)
    assert (a["from_stop"], a["to_stop"], a["travel_sec"]) == ("64", "1", 40.0)
    assert a["benchmark_sec"] == 45.0 and a["dwell_sec"] == 20.0
    assert a["dep_time"] == "2026-05-01T08:05:00-04:00"
    # stop 2 has no times: 1 -> 6 spans a gap, so the schedule's single-hop time doesn't apply
    assert (b["from_stop"], b["to_stop"], b["travel_sec"]) == ("1", "6", 90.0)
    assert b["benchmark_sec"] is None
    assert a["distance_mi"] is None and a["cars"] == ["1234"] and a["direction"] == 1


def test_bus_reads_only_the_requested_day(tmp_path):
    other = date(2026, 5, 2)
    rows = [bus_stop(D, "b", 1, "1", (8, 0, 0), (8, 0, 0)), bus_stop(D, "b", 2, "2", (8, 1, 0), (8, 1, 0)),
            bus_stop(other, "b", 1, "1", (8, 0, 0), (8, 0, 0)), bus_stop(other, "b", 2, "2", (8, 1, 0), (8, 1, 0))]
    assert [s["service_date"] for s in bus(tmp_path, rows)] == ["2026-05-01"]


def _two_stops(route="28", label="1234"):
    return [bus_stop(D, "b", 1, "1", (23, 10, 0), (23, 10, 0), route=route, label=label),
            bus_stop(D, "b", 2, "2", (23, 13, 0), (23, 13, 0), route=route, label=label)]


@pytest.mark.parametrize("route", ["34E", "708", "28"])
def test_bus_keeps_unmapped_routes(tmp_path, route):
    (s,) = bus(tmp_path, _two_stops(route))
    assert s["route_id"] == route and s["hour_bucket"] == "night"


@pytest.mark.parametrize("route", ["Red", "Mattapan", "Green-B", "CR-Fitchburg", "Boat-F1", "CapeFlyer"])
def test_bus_drops_rail_cr_and_boat_routes(tmp_path, route):
    assert bus(tmp_path, _two_stops(route)) == []


def test_bus_numbers_normalized(tmp_path):
    (s,) = bus(tmp_path, _two_stops(label="0952"))
    assert s["cars"] == ["952"]


def test_day_segments_sorted_and_only_requested(tmp_path, monkeypatch):
    rail_path = rail_file(tmp_path / "r.parquet", rail_trip(D, "z", ORANGE) + rail_trip(D, "a", ORANGE))
    monkeypatch.setattr(lamp, "RAIL_URL", str(rail_path))
    out = lamp.day_segments(D, ["orange"])
    assert out.keys() == {"orange"}
    assert [s["trip_id"] for s in out["orange"]] == ["a", "a", "z", "z"]
