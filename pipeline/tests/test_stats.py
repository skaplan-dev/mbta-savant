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
    # car 1 deltas: +5, +10, -5 -> median 5
    assert one["door_time_sec"] == pytest.approx(5)
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
