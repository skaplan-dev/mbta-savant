from datetime import date, timedelta

import pytest

from savant import stats
from savant.segments import write_day

D0 = date(2026, 3, 2)  # a Monday


def seg(day, trip, cars, travel, *, route="Orange", from_stop="A", to_stop="B", group="orange",
        dwell=None, benchmark=None, distance=1.0, occ=None, hour="midday"):
    return {
        "service_date": day.isoformat(),
        "group": group,
        "route_id": route,
        "direction": 0,
        "trip_id": trip,
        "from_stop": from_stop,
        "to_stop": to_stop,
        "dep_time": f"{day.isoformat()}T12:00:00-05:00",
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
    assert a["ttoe_sec"] < 0 < b["ttoe_sec"]
    assert b["ttoe_sec"] - a["ttoe_sec"] == pytest.approx(10)
    assert a["car_id"] == "orange:A1"
    assert a["trips"] == 6
    assert a["steadiness_sec"] == pytest.approx(0)


def test_games_played_ignores_days_without_group_data(tmp_path):
    days = [D0 + timedelta(days=i) for i in range(10)]
    data_days = [d for i, d in enumerate(days) if i not in (3, 7)]
    write(tmp_path, "orange", {d: [seg(d, "t", ["1500"], 100)] for d in data_days})
    (row,) = stats.car_stats(tmp_path, "orange", window(days[0], days[-1]))
    assert row["games_played_pct"] == 100
    # outage days do not break the streak either
    assert row["iron_horse_days"] == 8


def test_games_played_partial(tmp_path):
    days = [D0 + timedelta(days=i) for i in range(4)]
    write(tmp_path, "orange", {d: [seg(d, "t", ["X"] if i == 0 else ["Y"], 100)] for i, d in enumerate(days)})
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
        by_day[d] = [seg(d, "t", cars, 100)]
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
    assert row["top_speed_mph"] is None
    assert row["miles"] is None
    assert row["routes"] == 2
    assert row["teammates"] == []
    assert row["car_id"] == "bus:1234"
    (log,) = row["game_log"]
    assert log["miles"] is None
    assert log["routes"] == ["1", "47"]


def test_rail_speed_miles_crowd_door_teammates(tmp_path):
    segs = [
        # 1 mile in 60 s = 60 mph; 2 miles in 60 s = 120 mph
        seg(D0, "t1", ["1", "2"], 60, distance=1.0, dwell=30.0, occ=[50.0, 10.0]),
        seg(D0, "t2", ["1", "3"], 60, distance=2.0, from_stop="X", to_stop="Y", dwell=40.0, occ=[70.0]),
        seg(D0, "t3", ["1", "2"], 60, distance=1.0, dwell=20.0, occ=None),
        seg(D0, "t4", ["4"], 60, distance=2.0, from_stop="X", to_stop="Y", dwell=20.0),
    ]
    write(tmp_path, "orange", {D0: segs})
    rows = by_number(stats.car_stats(tmp_path, "orange", window(D0, D0)))
    one = rows["1"]
    assert one["miles"] == pytest.approx(4.0)
    assert one["top_speed_mph"] == pytest.approx(60 + 0.8 * 60)  # p90 of [60, 60, 120]
    assert one["crowd_load_pct"] == pytest.approx(60.0)  # only car 1's own readings
    assert rows["2"]["crowd_load_pct"] == pytest.approx(10.0)
    assert rows["4"]["crowd_load_pct"] is None
    # A->B dwells 30, 20 -> expected 25; X->Y dwells 40, 20 -> expected 30
    # car 1 deltas: +5, +10, -5 -> mean 10/3
    assert one["door_time_sec"] == pytest.approx(10 / 3)
    assert one["teammates"] == [["2", 2], ["3", 1]]
    assert one["routes"] is None
    (log,) = one["game_log"]
    assert log == {"date": D0.isoformat(), "trips": 3, "miles": pytest.approx(4.0),
                   "ttoe_sec": pytest.approx(0), "routes": ["Orange"]}


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
    assert c["ttoe_sec"] == pytest.approx(30.0)
    (log,) = c["game_log"]
    assert log["ttoe_sec"] == pytest.approx(30.0)


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
    assert c["door_time_sec"] == pytest.approx(15.0)


def test_speed_vs_expected(tmp_path):
    segs = []
    for stop in ("A", "B", "C"):
        nxt = chr(ord(stop) + 1)
        segs += [seg(D0, f"r{stop}{i}", ["R"], 100, from_stop=stop, to_stop=nxt) for i in range(10)]
        segs += [seg(D0, f"f{stop}", ["F"], 90, from_stop=stop, to_stop=nxt)]
        segs += [seg(D0, f"s{stop}", ["S"], 110, from_stop=stop, to_stop=nxt)]
    segs += [seg(D0, "x", ["X"], 1100)]  # 1,000 s over expected travels as 400 s
    write(tmp_path, "orange", {D0: segs})
    rows = by_number(stats.car_stats(tmp_path, "orange", window(D0, D0)))
    assert rows["F"]["speed_vs_expected_pct"] == pytest.approx(100 * (100 / 90 - 1))  # ~ +11.1
    assert rows["S"]["speed_vs_expected_pct"] == pytest.approx(100 * (100 / 110 - 1))  # ~ -9.1
    assert rows["R"]["speed_vs_expected_pct"] == pytest.approx(0)
    assert rows["X"]["speed_vs_expected_pct"] == pytest.approx(-75)


def test_speed_vs_expected_on_bus(tmp_path):
    segs = [seg(D0, f"r{i}", ["R"], 100, route="1", group="bus", distance=None) for i in range(5)]
    segs += [seg(D0, "f", ["F"], 80, route="1", group="bus", distance=None)]
    write(tmp_path, "bus", {D0: segs})
    rows = by_number(stats.car_stats(tmp_path, "bus", window(D0, D0)))
    assert rows["F"]["speed_vs_expected_pct"] == pytest.approx(25)


def test_multi_car_train_weighted_once(tmp_path):
    # Expected is the median over trains (100, 200) = 150, not over car rows (100, 200, 200, 200) = 200.
    segs = [seg(D0, "solo", ["1"], 100), seg(D0, "trio", ["2", "3", "4"], 200)]
    write(tmp_path, "orange", {D0: segs})
    rows = by_number(stats.car_stats(tmp_path, "orange", window(D0, D0)))
    assert rows["1"]["ttoe_sec"] == pytest.approx(-50)
    for n in ("2", "3", "4"):
        assert rows[n]["ttoe_sec"] == pytest.approx(50)


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
