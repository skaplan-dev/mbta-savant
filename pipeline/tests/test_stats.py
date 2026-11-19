from datetime import date, timedelta

import pytest

from savant import stats
from savant.segments import write_day

D0 = date(2026, 3, 2)  # a Monday


def seg(day, trip, cars, travel, *, route="Orange", from_stop="A", to_stop="B", group="orange",
        dwell=None, benchmark=None, distance=1.0, occ=None, hour="midday", dep="12:00:00"):
    return {
        "service_date": day.isoformat(),
        "group": group,
        "route_id": route,
        "direction": 0,
        "trip_id": trip,
        "from_stop": from_stop,
        "to_stop": to_stop,
        "dep_time": f"{day.isoformat()}T{dep}-05:00",
        "hour_bucket": hour,
        "day_type": "weekday",
        "travel_sec": float(travel),
        "dwell_sec": dwell,
        "benchmark_sec": benchmark,
        "distance_mi": distance,
        "cars": cars,
        "occupancy_pct": occ if occ is not None else [],
    }


def write(root, group, by_day):
    for day, segs in by_day.items():
        write_day(segs, root, group, day)


def by_number(rows):
    return {r["number"]: r for r in rows}


def window(start, end, key="test"):
    return stats.Window(key=key, start=start, end=end)


def test_ttoe_separates_fast_and_slow_car(tmp_path):
    segs = []
    for i in range(6):
        segs.append(seg(D0, f"a{i}", ["A1"], 100))
        segs.append(seg(D0, f"b{i}", ["B1"], 110))
    write(tmp_path, "orange", {D0: segs})
    rows = by_number(stats.car_stats(tmp_path, "orange", window(D0, D0)))
    a, b = rows["A1"], rows["B1"]
    assert a["travel_time_sec"] < 0 < b["travel_time_sec"]
    assert b["travel_time_sec"] - a["travel_time_sec"] == pytest.approx(10)
    assert "trip_time_sec" not in b and "exp_trip_sec" not in b
    assert b["exp_travel_sec"] > 0
    assert b["dwell_time_sec"] is None
    assert a["car_id"] == "orange:A1"
    assert a["trips"] == 6
    assert a["steadiness_sec"] == pytest.approx(0)


def test_games_played_ignores_days_without_group_data(tmp_path):
    days = [D0 + timedelta(days=i) for i in range(10)]
    data_days = [d for i, d in enumerate(days) if i not in (3, 7)]
    write(tmp_path, "orange", {d: [seg(d, "t", ["1500"], 100), seg(d, "u", ["1500"], 100)] for d in data_days})
    (row,) = stats.car_stats(tmp_path, "orange", window(days[0], days[-1]))
    assert row["games_played_pct"] == 100
    # outage days do not break the streak either
    assert row["iron_horse_days"] == 8


def test_games_played_partial(tmp_path):
    days = [D0 + timedelta(days=i) for i in range(4)]
    write(tmp_path, "orange", {
        d: [seg(d, t, ["X"] if i == 0 else ["Y"], 100) for t in ("t", "u")] for i, d in enumerate(days)
    })
    rows = by_number(stats.car_stats(tmp_path, "orange", window(days[0], days[-1])))
    assert rows["X"]["games_played_pct"] == pytest.approx(25)
    assert rows["Y"]["games_played_pct"] == pytest.approx(75)


def test_qualify_threshold(tmp_path):
    segs = [seg(D0, f"p{i}", ["P49"], 100) for i in range(49)]
    segs += [seg(D0, f"q{i}", ["Q50"], 100) for i in range(50)]
    # a second segment on the same trip does not count as another trip
    segs += [seg(D0, "p0", ["P49"], 100, from_stop="B", to_stop="C")]
    write(tmp_path, "orange", {D0: segs})
    rows = by_number(stats.car_stats(tmp_path, "orange", window(D0, D0)))
    assert rows["P49"]["trips"] == 49
    assert rows["P49"]["qualified"] is False
    assert rows["Q50"]["trips"] == 50
    assert rows["Q50"]["qualified"] is True


def test_iron_horse_streak(tmp_path):
    days = {i: D0 + timedelta(days=i - 1) for i in range(1, 7)}
    by_day = {}
    for i, d in days.items():
        cars = ["IH", "OTHER"] if i in (1, 2, 3, 5) else ["OTHER"]
        by_day[d] = [seg(d, "t", cars, 100), seg(d, "u", cars, 100)]
    write(tmp_path, "orange", by_day)
    rows = by_number(stats.car_stats(tmp_path, "orange", window(days[1], days[6])))
    assert rows["IH"]["iron_horse_days"] == 3
    assert rows["OTHER"]["iron_horse_days"] == 6


def test_on_time_null_without_benchmark(tmp_path):
    write(tmp_path, "orange", {D0: [seg(D0, "t1", ["N"], 100), seg(D0, "t2", ["M"], 100, benchmark=90),
                                    seg(D0, "t3", ["M"], 80, benchmark=90), seg(D0, "t4", ["M"], 95)]})
    rows = by_number(stats.car_stats(tmp_path, "orange", window(D0, D0)))
    assert rows["N"]["on_time_pct"] is None
    assert rows["M"]["on_time_pct"] == pytest.approx(50)


def test_bus_has_no_speed_or_miles(tmp_path):
    segs = [
        seg(D0, "t1", ["1234"], 100, route="1", group="bus", distance=None),
        seg(D0, "t2", ["1234"], 100, route="47", group="bus", distance=None),
    ]
    write(tmp_path, "bus", {D0: segs})
    (row,) = stats.car_stats(tmp_path, "bus", window(D0, D0))
    assert row["miles"] is None
    assert row["routes"] == 2
    assert row["teammates"] == []
    assert row["car_id"] == "bus:1234"
    (log,) = row["game_log"]
    assert log["miles"] is None
    assert log["routes"] == ["1", "47"]


def test_rail_miles_crowd_door_teammates(tmp_path):
    segs = [
        seg(D0, "t1", ["1", "2"], 60, distance=1.0, dwell=30.0, occ=[50.0, 10.0]),
        seg(D0, "t2", ["1", "3"], 60, distance=2.0, from_stop="X", to_stop="Y", dwell=40.0, occ=[70.0]),
        seg(D0, "t3", ["1", "2"], 60, distance=1.0, dwell=20.0, occ=None),
        seg(D0, "t4", ["4"], 60, distance=2.0, from_stop="X", to_stop="Y", dwell=20.0),
    ]
    write(tmp_path, "orange", {D0: segs})
    rows = by_number(stats.car_stats(tmp_path, "orange", window(D0, D0)))
    one = rows["1"]
    assert one["miles"] == pytest.approx(4.0)
    assert one["crowd_load_pct"] == pytest.approx(60.0)  # only car 1's own readings
    assert rows["2"]["crowd_load_pct"] == pytest.approx(10.0)
    assert rows["4"]["crowd_load_pct"] is None
    # A->B dwells 30, 20 -> expected 25; X->Y dwells 40, 20 -> expected 30
    # car 1 deltas: +5, +10, -5 -> mean 10/3
    assert one["dwell_time_sec"] == pytest.approx(10 / 3)
    assert one["teammates"] == [["2", 2], ["3", 1]]
    assert one["routes"] is None
    (log,) = one["game_log"]
    assert log == {"date": D0.isoformat(), "trips": 3, "miles": pytest.approx(4.0),
                   "travel_time_sec": pytest.approx(0.0), "routes": ["Orange"]}  # travel only; the deltas above are dwell


def test_window_filters_dates(tmp_path):
    d1, d2 = D0, D0 + timedelta(days=1)
    write(tmp_path, "orange", {d1: [seg(d1, "t", ["Z"], 100)], d2: [seg(d2, "t", ["Z"], 100)]})
    (row,) = stats.car_stats(tmp_path, "orange", window(d2, d2))
    assert row["trips"] == 1
    assert [g["date"] for g in row["game_log"]] == [d2.isoformat()]


def test_car_stats_empty_group(tmp_path):
    assert stats.car_stats(tmp_path, "red", window(D0, D0)) == []


def test_windows(tmp_path):
    assert stats.windows(tmp_path) == []
    write(tmp_path, "orange", {date(2025, 12, 30): [seg(date(2025, 12, 30), "t", ["Z"], 100)]})
    write(tmp_path, "bus", {date(2026, 1, 5): [seg(date(2026, 1, 5), "t", ["Z"], 100, group="bus")]})
    ws = {w.key: w for w in stats.windows(tmp_path)}
    assert set(ws) == {"2025", "2026", "last30"}
    assert ws["2025"] == stats.Window("2025", date(2025, 1, 1), date(2025, 12, 31))
    assert ws["last30"] == stats.Window("last30", date(2025, 12, 7), date(2026, 1, 5))


def test_ttoe_caps_each_segment_delta_at_300(tmp_path):
    segs = [seg(D0, f"r{i}", ["R"], 100) for i in range(10)]
    segs += [seg(D0, f"c{i}", ["C"], 100) for i in range(9)]
    segs += [seg(D0, "c9", ["C"], 3700)]  # 3,600 s over expected counts as 300
    write(tmp_path, "orange", {D0: segs})
    c = by_number(stats.car_stats(tmp_path, "orange", window(D0, D0)))["C"]
    assert c["travel_time_sec"] == pytest.approx(30.0)
    (log,) = c["game_log"]
    assert log["travel_time_sec"] == pytest.approx(30.0)


def _reference(n=20):
    """Car R runs every stretch in 100 s, so expected travel is 100 s."""
    return [seg(D0, f"r{i}", ["R"], 100) for i in range(n)]


def test_steadiness_clips_each_delta_at_60(tmp_path):
    # C deltas 0, 0, +1000, +1000 clip to 0, 0, 60, 60: median 30, mean distance from it 30
    segs = _reference() + [seg(D0, f"c{i}", ["C"], t) for i, t in enumerate((100, 100, 1100, 1100))]
    write(tmp_path, "orange", {D0: segs})
    c = by_number(stats.car_stats(tmp_path, "orange", window(D0, D0)))["C"]
    assert c["steadiness_sec"] == pytest.approx(30.0)


def test_steadiness_ignores_a_steady_offset(tmp_path):
    # Always 10 s slow is slow, not inconsistent
    segs = _reference() + [seg(D0, f"c{i}", ["C"], 110) for i in range(4)]
    write(tmp_path, "orange", {D0: segs})
    c = by_number(stats.car_stats(tmp_path, "orange", window(D0, D0)))["C"]
    assert c["steadiness_sec"] == pytest.approx(0.0)


def test_steadiness_resolves_below_one_second(tmp_path):
    # Whole-second deltas; an IQR or median would tie these two cars, the mean deviation doesn't
    segs = _reference()
    segs += [seg(D0, f"a{i}", ["A"], t) for i, t in enumerate((100, 101, 101, 101))]  # median 1 -> 0.25
    segs += [seg(D0, f"b{i}", ["B"], t) for i, t in enumerate((100, 100, 101, 101))]  # median 0.5 -> 0.5
    write(tmp_path, "orange", {D0: segs})
    rows = by_number(stats.car_stats(tmp_path, "orange", window(D0, D0)))
    assert rows["A"]["steadiness_sec"] == pytest.approx(0.25)
    assert rows["B"]["steadiness_sec"] == pytest.approx(0.5)


def test_door_time_clips_each_dwell_delta_at_30(tmp_path):
    # Typical dwell is 20 s; C's 120 s terminal hold counts as +30
    segs = [seg(D0, f"r{i}", ["R"], 100, dwell=20.0) for i in range(20)]
    segs += [seg(D0, f"c{i}", ["C"], 100, dwell=d) for i, d in enumerate((20.0, 120.0))]
    write(tmp_path, "orange", {D0: segs})
    c = by_number(stats.car_stats(tmp_path, "orange", window(D0, D0)))["C"]
    assert c["dwell_time_sec"] == pytest.approx(15.0)


def _trips(cars_travel, dwell_by_car=None, n=6, stops="ABCD", route="Orange", group="orange"):
    """``n`` trips per car, each running ``stops`` as consecutive segments."""
    segs = []
    for car, travel in cars_travel.items():
        dwell = (dwell_by_car or {}).get(car)
        for i in range(n):
            for a, b in zip(stops, stops[1:]):
                segs.append(seg(D0, f"{car}{i}", [car], travel, from_stop=a, to_stop=b, dwell=dwell,
                                route=route, group=group, distance=None if group == "bus" else 1.0))
    return segs


def test_travel_time_scales_by_segments_per_trip(tmp_path):
    write(tmp_path, "orange", {D0: _trips({"X": 100, "Y": 110})})
    rows = by_number(stats.car_stats(tmp_path, "orange", window(D0, D0)))
    assert rows["Y"]["travel_time_sec"] - rows["X"]["travel_time_sec"] == pytest.approx(30)
    assert rows["X"]["segs_per_trip"] == 3


def test_dwell_is_clipped_per_trip(tmp_path):
    write(tmp_path, "orange", {D0: _trips({"X": 100, "Y": 100, "Z": 100}, {"X": 20.0, "Y": 120.0, "Z": 20.0})})
    rows = by_number(stats.car_stats(tmp_path, "orange", window(D0, D0)))
    x, y = rows["X"], rows["Y"]
    assert y["dwell_time_sec"] - x["dwell_time_sec"] == pytest.approx(3 * 30)
    assert y["exp_travel_sec"] == pytest.approx(3 * 100)


def test_null_dwell_keeps_travel_delta(tmp_path):
    write(tmp_path, "orange", {D0: _trips({"X": 100, "Y": 110})})
    rows = by_number(stats.car_stats(tmp_path, "orange", window(D0, D0)))
    for r in rows.values():
        assert r["dwell_time_sec"] is None or r["dwell_time_sec"] == 0
    assert rows["Y"]["travel_time_sec"] - rows["X"]["travel_time_sec"] == pytest.approx(10 * 3)


def test_bus_route_uses_route_segments_per_trip(tmp_path):
    segs = _trips({"1": 100, "2": 100}, stops="ABC", route="1", group="bus")
    segs += _trips({"1": 100, "2": 100}, stops="ABCDE", route="2", group="bus")
    write(tmp_path, "bus", {D0: segs})
    rows = by_number(stats.car_stats(tmp_path, "bus", window(D0, D0)))
    by = {r["route"]: r for r in rows["1"]["by_route"]}
    assert by["1"]["segs_per_trip"] == 2
    assert by["2"]["segs_per_trip"] == 4


def test_game_log_has_travel_time(tmp_path):
    write(tmp_path, "orange", {D0: _trips({"X": 100, "Y": 110})})
    row = by_number(stats.car_stats(tmp_path, "orange", window(D0, D0)))["Y"]
    log = row["game_log"][0]
    assert "ttoe_sec" not in log
    assert log["travel_time_sec"] == pytest.approx(row["travel_time_sec"])
    assert "trip_time_sec" not in log


def test_old_fields_removed(tmp_path):
    write(tmp_path, "orange", {D0: _trips({"X": 100})})
    (row,) = stats.car_stats(tmp_path, "orange", window(D0, D0))
    for f in ("ttoe_sec", "door_time_sec", "speed_vs_expected_pct"):
        assert f not in row


def test_multi_car_train_weighted_once(tmp_path):
    # Expected is the median over trains (100, 200) = 150, not over car rows (100, 200, 200, 200) = 200.
    segs = [seg(D0, "solo", ["1"], 100), seg(D0, "trio", ["2", "3", "4"], 200)]
    write(tmp_path, "orange", {D0: segs})
    rows = by_number(stats.car_stats(tmp_path, "orange", window(D0, D0)))
    assert rows["1"]["travel_time_sec"] == pytest.approx(-50)
    for n in ("2", "3", "4"):
        assert rows[n]["travel_time_sec"] == pytest.approx(50)


def test_duckdb_spill_directory_under_root(tmp_path):
    write(tmp_path, "orange", {D0: [seg(D0, "t", ["Z"], 100)]})
    stats.car_stats(tmp_path, "orange", window(D0, D0))
    assert (tmp_path / ".duckdb_tmp").is_dir()


def test_qualify_threshold_scales_with_median():
    assert stats.QUALIFY_SHARE == 0.25
    assert stats.qualify_threshold([1000, 1000, 1000, 120]) == 250
    assert stats.qualify_threshold([10, 20]) == 50
    assert stats.qualify_threshold([201, 201]) == 51  # ceil(50.25)
    assert stats.qualify_threshold([]) == 50


def test_qualify_uses_quarter_of_median_trips(tmp_path):
    segs = [seg(D0, f"{n}-{i}", [n], 100) for n in ("A", "B", "C") for i in range(1000)]
    segs += [seg(D0, f"D-{i}", ["D"], 100) for i in range(120)]
    write(tmp_path, "orange", {D0: segs})
    rows = by_number(stats.car_stats(tmp_path, "orange", window(D0, D0)))
    assert rows["D"]["trips"] == 120 and rows["D"]["qualified"] is False
    assert all(rows[n]["qualified"] for n in "ABC")


def test_bus_numbers_normalized_on_read_across_cached_segments(tmp_path):
    write(tmp_path, "bus", {
        D0: [seg(D0, "t1", ["0952"], 100, route="1", group="bus")],
        D0 + timedelta(1): [seg(D0 + timedelta(1), "t2", ["952"], 100, route="1", group="bus")],
    })
    rows = stats.car_stats(tmp_path, "bus", window(D0, D0 + timedelta(1)))
    assert [r["number"] for r in rows] == ["952"]
    assert rows[0]["trips"] == 2


def test_bus_by_route_splits_stats_per_route(tmp_path):
    # Bus 1 runs the 1 fast (25 trips) and the 47 slow (5 trips); bus 2 sets the expected times.
    d1 = D0 + timedelta(days=1)
    segs0 = [seg(D0, f"a{i}", ["1"], 90, route="1", group="bus", distance=None) for i in range(25)]
    segs0 += [seg(D0, f"b{i}", ["1"], 130, route="47", group="bus", distance=None) for i in range(5)]
    segs0 += [seg(D0, f"c{i}", ["2"], 110, route=r, group="bus", distance=None) for i in range(25) for r in ("1", "47")]
    segs1 = [seg(d1, f"d{i}", ["2"], 110, route="1", group="bus", distance=None) for i in range(3)]
    write(tmp_path, "bus", {D0: segs0, d1: segs1})
    rows = by_number(stats.car_stats(tmp_path, "bus", window(D0, d1)))
    r1 = {r["route"]: r for r in rows["1"]["by_route"]}
    assert set(r1) == {"1", "47"}
    assert r1["1"]["trips"] == 25 and r1["1"]["qualified"] is True
    assert r1["47"]["trips"] == 5 and r1["47"]["qualified"] is False  # under ROUTE_QUALIFY_MIN_TRIPS
    assert r1["1"]["travel_time_sec"] < 0 < r1["47"]["travel_time_sec"]
    # The 1 ran on both days and bus 1 only on the first; the 47 ran only on the first day.
    assert r1["1"]["games_played_pct"] == pytest.approx(50)
    assert r1["47"]["games_played_pct"] == pytest.approx(100)
    assert "route_id" not in r1["1"] and "routes" not in r1["1"]


def test_rail_has_no_by_route(tmp_path):
    write(tmp_path, "orange", {D0: [seg(D0, "t", ["1400"], 100)]})
    (row,) = stats.car_stats(tmp_path, "orange", window(D0, D0))
    assert "by_route" not in row


def test_last_seen_spans_all_data_not_one_window(tmp_path):
    later = D0 + timedelta(days=400)
    write(tmp_path, "orange", {D0: [seg(D0, "a", ["A1", "B1"], 100)], later: [seg(later, "b", ["A1"], 100)]})
    assert stats.last_seen(tmp_path, "orange") == {"A1": later.isoformat(), "B1": D0.isoformat()}


def test_last_seen_normalizes_bus_numbers(tmp_path):
    write(tmp_path, "bus", {D0: [seg(D0, "a", ["0952"], 100, group="bus", route="1")]})
    assert stats.last_seen(tmp_path, "bus") == {"952": D0.isoformat()}


def test_last_seen_empty_group(tmp_path):
    assert stats.last_seen(tmp_path, "blue") == {}


def test_dwell_averages_over_all_segments_so_trip_is_travel_plus_dwell(tmp_path):
    # X is missing dwell on one segment per trip; Y has none at all.
    segs = []
    for car, dwells in (("X", {"B": 50.0, "C": None, "D": 50.0}), ("Z", {"B": 20.0, "C": 20.0, "D": 20.0}),
                        ("Y", {"B": None, "C": None, "D": None})):
        for i in range(6):
            for a, b in zip("ABC", "BCD"):
                segs.append(seg(D0, f"{car}{i}", [car], 100, from_stop=a, to_stop=b, dwell=dwells[b]))
    write(tmp_path, "orange", {D0: segs})
    rows = by_number(stats.car_stats(tmp_path, "orange", window(D0, D0)))
    x, y = rows["X"], rows["Y"]
    assert "trip_time_sec" not in x
    assert y["dwell_time_sec"] is None


def two_trips(day, cars, travel=100, **kw):
    return [seg(day, f"t{i}", cars, travel, **kw) for i in range(2)]


def test_rail_day_needs_two_trips(tmp_path):
    d1 = D0 + timedelta(days=1)
    write(tmp_path, "orange", {
        D0: [seg(D0, "a", ["A"], 100)] + two_trips(D0, ["B"]),
        d1: two_trips(d1, ["A"]) + two_trips(d1, ["B"], from_stop="C"),
    })
    rows = by_number(stats.car_stats(tmp_path, "orange", window(D0, d1)))
    assert rows["A"]["service_days"] == 1
    assert rows["A"]["games_played_pct"] == pytest.approx(50.0)
    assert rows["B"]["games_played_pct"] == pytest.approx(100.0)


def test_bus_day_counts_one_trip(tmp_path):
    d1 = D0 + timedelta(days=1)
    write(tmp_path, "bus", {d: [seg(d, "t", ["0952"], 100, route="1", group="bus")] for d in (D0, d1)})
    (row,) = stats.car_stats(tmp_path, "bus", window(D0, d1))
    assert row["service_days"] == 2
    assert row["by_route"][0]["service_days"] == 2


def test_first_seen_limits_eligible_days(tmp_path):
    days = [D0 + timedelta(days=i) for i in range(4)]
    by_day = {d: two_trips(d, ["OLD"]) for d in days}
    for d in days[2:]:
        by_day[d] += two_trips(d, ["N"], from_stop="C")
    by_day[days[1]] += [seg(days[1], "x", ["N"], 100, from_stop="C")]  # a 1-trip day before delivery doesn't count
    write(tmp_path, "orange", by_day)
    fs = stats.first_seen(tmp_path, "orange")
    assert fs["N"] == days[2].isoformat()
    w = window(days[0], days[-1])
    n = by_number(stats.car_stats(tmp_path, "orange", w, first_seen=fs))["N"]
    assert n["eligible_days"] == 2
    assert n["games_played_pct"] == pytest.approx(100.0)
    n = by_number(stats.car_stats(tmp_path, "orange", w))["N"]
    assert n["eligible_days"] == 4
    assert n["games_played_pct"] == pytest.approx(50.0)


def test_zero_eligible_days_gives_no_games_played_pct(tmp_path):
    days = [D0 + timedelta(days=i) for i in range(2)]
    write(tmp_path, "orange", {d: two_trips(d, ["N"]) for d in days})
    late = {"N": (days[-1] + timedelta(days=5)).isoformat()}  # first service after the window
    (row,) = stats.car_stats(tmp_path, "orange", window(days[0], days[-1]), first_seen=late)
    assert row["eligible_days"] == 0
    assert row["games_played_pct"] is None


def test_first_last_seen_in_one_scan(tmp_path):
    d1 = D0 + timedelta(days=1)
    write(tmp_path, "orange", {D0: [seg(D0, "x", ["A1"], 100)], d1: two_trips(d1, ["A1"])})
    first, last = stats.first_last_seen(tmp_path, "orange")
    assert first == {"A1": d1.isoformat()}  # D0 was a 1-trip day
    assert last == {"A1": d1.isoformat()}
    assert stats.first_last_seen(tmp_path, "blue") == ({}, {})


def test_new_deliveries_only_for_fleets_still_arriving():
    first = {
        "1400": "2025-06-01",  # Orange 1400-1551, built 2018-25: still arriving in 2025
        "1000": "2025-06-01",  # an old bus (2008), absent at the start of our data
        "4200": "2025-09-01",  # bus 4200s, built 2024-26
        "9999": "2025-06-01",  # not on the roster
    }
    assert stats.new_deliveries({k: first[k] for k in ("1400",)}, "orange") == {"1400": "2025-06-01"}
    assert stats.new_deliveries(first, "bus") == {"4200": "2025-09-01"}


def test_old_fleet_first_seen_not_applied_but_new_fleet_is(tmp_path):
    days = [D0 + timedelta(days=i) for i in range(4)]
    by_day = {d: two_trips(d, ["OLD"]) for d in days}
    for d in days[2:]:
        by_day[d] += two_trips(d, ["N"], from_stop="C")
    write(tmp_path, "orange", by_day)
    first = {"OLD": days[2].isoformat(), "N": days[2].isoformat()}
    # fake the roster: N is a new delivery, OLD an old fleet
    delivered = {k: v for k, v in first.items() if k == "N"}
    rows = by_number(stats.car_stats(tmp_path, "orange", window(days[0], days[-1]), first_seen=delivered))
    assert rows["OLD"]["eligible_days"] == 4
    assert rows["N"]["eligible_days"] == 2


def test_first_seen_normalizes_bus_numbers_and_empty(tmp_path):
    write(tmp_path, "bus", {D0: [seg(D0, "t", ["0952"], 100, route="1", group="bus")]})
    assert stats.first_seen(tmp_path, "bus") == {"952": D0.isoformat()}
    assert stats.first_seen(tmp_path, "blue") == {}


def test_trip_len_is_median_trip_duration(tmp_path):
    # trip = first departure to last arrival: 300, 500, 400 seconds
    segs = [
        seg(D0, "t1", ["A", "B"], 300, dep="12:00:00"),
        seg(D0, "t2", ["A", "B"], 200, dep="13:00:00"),
        seg(D0, "t2", ["A", "B"], 300, dep="13:03:20", from_stop="B", to_stop="C"),
        seg(D0, "t3", ["A", "B"], 400, dep="14:00:00"),
    ]
    write(tmp_path, "orange", {D0: segs})
    rows = by_number(stats.car_stats(tmp_path, "orange", window(D0, D0)))
    assert rows["A"]["trip_len_sec"] == pytest.approx(400)
    assert rows["B"]["trip_len_sec"] == pytest.approx(400)


def test_bus_trip_len_per_route(tmp_path):
    write(tmp_path, "bus", {D0: [
        seg(D0, "t1", ["9"], 300, route="1", group="bus"),
        seg(D0, "t2", ["9"], 600, route="2", group="bus"),
    ]})
    (row,) = stats.car_stats(tmp_path, "bus", window(D0, D0))
    assert row["trip_len_sec"] == pytest.approx(450)
    assert {r["route"]: r["trip_len_sec"] for r in row["by_route"]} == {"1": 300, "2": 600}


def _runs(day, key_stop, noise, cars, n, start=0):
    return [seg(day, f"{key_stop}{cars[0]}{start + i}", cars, 100 + noise * (1 if i % 2 else -1), from_stop=key_stop,
                to_stop=key_stop + "z") for i in range(n)]


def test_steady_adj_compares_with_same_segments(tmp_path):
    segs = []
    for car in ("X", "X2"):
        segs += _runs(D0, "noisy", 40, [car], 20)
    for car in ("Y", "Y2"):
        segs += _runs(D0, "calm", 5, [car], 20)
    write(tmp_path, "orange", {D0: segs})
    rows = by_number(stats.car_stats(tmp_path, "orange", window(D0, D0)))
    assert abs(rows["X"]["steady_adj_sec"]) < 0.5
    assert abs(rows["Y"]["steady_adj_sec"]) < 0.5
    assert abs(rows["X"]["steadiness_sec"] - rows["Y"]["steadiness_sec"]) > 20


def test_steady_adj_null_when_thin(tmp_path):
    segs = _runs(D0, "thin", 10, ["T"], 10) + _runs(D0, "calm", 5, ["C"], 20)
    write(tmp_path, "orange", {D0: segs})
    rows = by_number(stats.car_stats(tmp_path, "orange", window(D0, D0)))
    assert rows["T"]["steady_adj_sec"] is None
    assert rows["C"]["steady_adj_sec"] is not None


def test_bus_by_route_has_steady_adj(tmp_path):
    segs = [seg(D0, f"t{i}", ["7"], 100 + (10 if i % 2 else -10), route="1", group="bus") for i in range(20)]
    write(tmp_path, "bus", {D0: segs})
    (row,) = stats.car_stats(tmp_path, "bus", window(D0, D0))
    assert row["by_route"][0]["steady_adj_sec"] == pytest.approx(0)
