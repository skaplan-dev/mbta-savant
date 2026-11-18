import json
from datetime import date

from savant import publish
from savant.segments import write_day

D0 = date(2026, 3, 2)


def car(number, ttoe, qualified=True, **kw):
    base = {m: None for m in publish.METRICS}
    base.update(ttoe_sec=ttoe)
    return {"car_id": f"orange:{number}", "number": number, "qualified": qualified, **base, **kw}


def pcts(group, cars, metric="ttoe_sec"):
    return {c["number"]: c["pct"][metric] for c in publish.add_percentiles(group, cars)}


def test_single_qualified_car_gets_100():
    assert pcts("orange", [car("1400", 3.0)]) == {"1400": 100}


def test_no_qualified_cars_all_null():
    out = publish.add_percentiles("orange", [car("1400", 1.0, False), car("1401", 2.0, False)])
    assert all(v is None for c in out for v in c["pct"].values())


def test_three_cars_lower_is_better():
    assert pcts("orange", [car("1400", -5), car("1401", 0), car("1402", 5)]) == {"1400": 100, "1401": 50, "1402": 0}


def test_higher_is_better_and_ties_do_not_beat():
    cars = [car(n, 0, top_speed_mph=v) for n, v in (("1400", 10), ("1401", 20), ("1402", 20))]
    # a beats none; b and c each beat only a (strict), so 50
    assert pcts("orange", cars, "top_speed_mph") == {"1400": 0, "1401": 50, "1402": 50}


def test_none_values_and_unqualified_excluded():
    cars = [car("1400", 1), car("1401", None), car("1402", 2), car("1403", 0, qualified=False)]
    got = pcts("orange", cars)
    assert got == {"1400": 100, "1401": None, "1402": 0, "1403": None}


def test_unranked_metric_is_none():
    out = publish.add_percentiles("orange", [car("1400", 1, crowd_load_pct=50.0)])
    assert out[0]["pct"]["crowd_load_pct"] is None


def test_mattapan_never_ranked():
    out = publish.add_percentiles("mattapan", [car("3087", 1), car("3230", 2)])
    assert all(v is None for c in out for v in c["pct"].values())


def test_non_roster_car_unranked_and_excluded_from_n():
    cars = [{**car("3901", 1.0), "car_id": "green:3901"}, {**car("3000", 2.0), "car_id": "green:3000"}]
    out = {c["number"]: c for c in publish.add_percentiles("green", cars)}
    assert out["3901"]["pct"]["ttoe_sec"] == 100 and out["3901"]["ranked"] is True
    assert out["3000"]["ranked"] is False
    assert all(v is None for v in out["3000"]["pct"].values())


def test_mattapan_cars_not_ranked_flag():
    out = publish.add_percentiles("mattapan", [car("3087", 1)])
    assert out[0]["ranked"] is False


def seg(day, trip, cars, travel, group, route):
    return {
        "service_date": day.isoformat(), "group": group, "route_id": route, "direction": 0,
        "trip_id": trip, "from_stop": "A", "to_stop": "B", "dep_time": f"{day.isoformat()}T12:00:00-05:00",
        "hour_bucket": "midday", "day_type": "weekday", "travel_sec": float(travel), "dwell_sec": None,
        "benchmark_sec": None, "distance_mi": 1.0, "cars": cars, "occupancy_pct": [],
    }


def build(tmp_path):
    root = tmp_path / "root"
    for group, route in (("orange", "Orange"), ("bus", "1")):
        segs = [seg(D0, f"{n}-{i}", [n], t, group, route)
                for i in range(50) for n, t in (("1400", 100), ("1401", 110))]
        write_day(segs, root, group, D0)
    out = tmp_path / "out"
    publish.publish(root, out)
    return out


def load(p):
    return json.loads(p.read_text())


def test_bus_and_orange_1400_are_separate_files(tmp_path):
    out = build(tmp_path)
    bus = load(out / "data/last30/cars/bus/1400.json")
    orange = load(out / "data/last30/cars/orange/1400.json")
    assert bus["car_id"] == "bus:1400" and orange["car_id"] == "orange:1400"
    assert bus["vehicle"]["model"] != orange["vehicle"]["model"]
    assert "game_log" in orange and bus["crowd_load_pct"] is None
    assert orange["pct"]["ttoe_sec"] == 100


def test_layout(tmp_path):
    out = build(tmp_path)
    g = load(out / "data/last30/groups/orange.json")
    assert g["group"] == "orange" and g["window"] == "last30" and "generated_at" in g
    assert all("game_log" not in c for c in g["cars"])
    idx = load(out / "data/last30/index.json")
    assert {r["car_id"] for r in idx} == {"orange:1400", "orange:1401", "bus:1400", "bus:1401"}
    assert set(idx[0]) == {"car_id", "group", "number", "fleet_label", "qualified", "ranked", "ttoe_sec", "pct_ttoe"}
    meta = load(out / "data/meta.json")
    assert meta["latest_service_date"] == "2026-03-02"
    assert [w["key"] for w in meta["windows"]] == ["last30", "2026"]
    fl = load(out / "data/fleets/orange.json")
    assert "last30" in fl
    publish.publish(tmp_path / "root", out)  # overwrite is fine
