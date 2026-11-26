import json
import shutil

import pytest
from datetime import date

from savant import publish
from savant.segments import write_day

D0 = date(2026, 3, 2)


def car(number, trip, qualified=True, **kw):
    base = {m: None for m in publish.METRICS}
    base.update(travel_time_sec=trip)
    return {"car_id": f"orange:{number}", "number": number, "qualified": qualified, **base, **kw}


def pcts(group, cars, metric="travel_time_sec"):
    return {c["number"]: c["pct"][metric] for c in publish.add_percentiles(group, cars)}


def test_single_qualified_car_gets_100():
    pool = [car(f"140{i}", 1000.0 + i * 20) for i in range(5)]
    assert pcts("orange", pool)["1400"] == 100  # lowest of five


def test_no_qualified_cars_all_null():
    out = publish.add_percentiles("orange", [car("1400", 1.0, False), car("1401", 2.0, False)])
    assert all(v is None for c in out for v in c["pct"].values())


def test_five_cars_lower_is_better():
    cars = [car(f"140{i}", v) for i, v in enumerate((0, 20, 40, 60, 80))]
    assert list(pcts("orange", cars).values()) == [100, 75, 50, 25, 0]


def test_higher_is_better_and_ties_do_not_beat():
    cars = [car(n, 0, on_time_pct=v) for n, v in (("1400", 10), ("1401", 20), ("1402", 20), ("1403", 30), ("1404", 40))]
    assert pcts("orange", cars, "on_time_pct") == {"1400": 0, "1401": 25, "1402": 25, "1403": 75, "1404": 100}


def test_none_values_and_unqualified_excluded():
    cars = [car(f"140{i}", v) for i, v in enumerate((0, 20, 40, 60, 80))]
    cars += [car("1409", None), car("1410", 0, qualified=False)]
    got = pcts("orange", cars)
    assert got["1409"] is None and got["1410"] is None and got["1400"] == 100


def test_unranked_metric_is_none():
    out = publish.add_percentiles("orange", [car("1400", 1, crowd_load_pct=50.0)])
    assert out[0]["pct"]["crowd_load_pct"] is None


def test_mattapan_never_ranked():
    out = publish.add_percentiles("mattapan", [car("3087", 1), car("3230", 2)])
    assert all(v is None for c in out for v in c["pct"].values())


def test_non_roster_car_unranked_and_excluded_from_n():
    cars = [{**car(n, t), "car_id": f"green:{n}"} for n, t in
            (("3901", 1.0), ("3902", 20.0), ("3903", 40.0), ("3904", 60.0), ("3905", 80.0), ("3000", 2.0))]
    out = {c["number"]: c for c in publish.add_percentiles("green", cars)}
    assert out["3901"]["pct"]["travel_time_sec"] == 100 and out["3901"]["ranked"] is True
    assert out["3000"]["ranked"] is False
    assert all(v is None for v in out["3000"]["pct"].values())


def test_mattapan_cars_not_ranked_flag():
    out = publish.add_percentiles("mattapan", [car("3087", 1)])
    assert out[0]["ranked"] is False


def seg(day, trip, cars, travel, group, route):
    return {
        "service_date": day.isoformat(), "group": group, "route_id": route, "direction": 0,
        "trip_id": trip, "from_stop": "A", "to_stop": "B", "dep_time": f"{day.isoformat()}T12:00:00-05:00",
        "hour_bucket": "midday", "day_type": "weekday", "travel_sec": float(travel), "dwell_sec": 20.0,
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
    assert orange["travel_vs_typical_sec"] is not None and "ttoe_sec" not in orange
    assert "segs_per_trip" not in orange
    assert "trip_len_sec" not in orange and "trips_per_day" not in orange
    assert {"first_seen", "eligible_days", "service_days", "steady_adj_sec", "tar", "tar_parts"} <= set(orange)


def test_layout(tmp_path):
    out = build(tmp_path)
    g = load(out / "data/last30/groups/orange.json")
    assert g["group"] == "orange" and g["window"] == "last30" and "generated_at" in g
    assert all("game_log" not in c for c in g["cars"])
    assert {"trip_len_sec", "trips_per_day", "tar_replacement", "segs_per_trip"} <= set(g)
    assert set(g["tar_replacement"]) == {"service_share", "fast_sec", "steady_adj_sec"}
    assert all("trip_len_sec" not in c for c in g["cars"])
    summ = load(out / "data/last30/groups/orange.summary.json")
    assert {"trip_len_sec", "trips_per_day", "tar_replacement"} <= set(summ)
    rb = load(out / "data/last30/routes/1.json")
    assert {"trip_len_sec", "trips_per_day", "tar_replacement", "segs_per_trip"} <= set(rb)
    idx = load(out / "data/last30/index.json")
    assert {r["car_id"] for r in idx} == {"orange:1400", "orange:1401", "bus:1400", "bus:1401"}
    assert set(idx[0]) == {"car_id", "group", "number", "fleet_label", "qualified", "ranked", "travel_vs_typical_sec", "pct_travel", "tar", "pct_tar"}
    meta = load(out / "data/meta.json")
    assert meta["latest_service_date"] == "2026-03-02"
    assert [w["key"] for w in meta["windows"]] == ["career", "last30", "2026"]
    fl = load(out / "data/fleets/orange.json")
    assert "last30" in fl
    publish.publish(tmp_path / "root", out)  # overwrite is fine


def _ranked(cars, group="orange"):
    return publish.add_percentiles(group, cars)


def test_metrics_lists_per_trip_fields():
    assert list(publish.METRICS)[:2] == ["travel_time_sec", "dwell_time_sec"]
    assert not [k for k in publish.METRICS if k.startswith("trip")]
    assert not {"ttoe_sec", "door_time_sec", "speed_vs_expected_pct"} & set(publish.METRICS)


def test_vs_typical_centers_on_median():
    cars = _ranked([car("1400", 0.0, exp_travel_sec=100.0), car("1401", 1.0, exp_travel_sec=100.0),
                    car("1402", 10.0, exp_travel_sec=100.0)])
    typical = publish.add_vs_typical(cars)
    assert typical["travel_time_sec"] == 1
    assert [c["travel_vs_typical_sec"] for c in cars] == [-1, 0, 9]
    assert [c["travel_vs_typical_pct"] for c in cars] == [-1.0, 0.0, 9.0]
    assert typical["dwell_time_sec"] is None and cars[0]["dwell_vs_typical_sec"] is None


def test_vs_typical_non_ranked_centered_but_not_in_median():
    cars = [{**car(n, t), "car_id": f"green:{n}"} for n, t in (("3901", 4.0), ("3902", 6.0), ("3000", 100.0))]
    cars = _ranked([*cars, {**car("3903", 50.0, qualified=False), "car_id": "green:3903"}], "green")
    typical = publish.add_vs_typical(cars)
    assert typical["travel_time_sec"] == 5.0
    by = {c["number"]: c for c in cars}
    assert by["3000"]["ranked"] is False and by["3000"]["travel_vs_typical_sec"] == 95.0
    assert by["3903"]["travel_vs_typical_sec"] == 45.0


def test_vs_typical_missing_values_and_pct_without_expected():
    cars = _ranked([car("1400", 1.0), car("1401", None)])
    publish.add_vs_typical(cars)
    assert cars[0]["travel_vs_typical_sec"] == 0.0 and cars[0]["travel_vs_typical_pct"] is None
    assert cars[1]["travel_vs_typical_sec"] is None


def test_mattapan_has_no_typical():
    cars = _ranked([car("3087", 1.0), car("3234", 3.0)], "mattapan")
    typical = publish.add_vs_typical(cars)
    assert typical == {"travel_time_sec": None, "dwell_time_sec": None}
    assert all(c["travel_vs_typical_sec"] is None and c["travel_vs_typical_pct"] is None for c in cars)
    assert publish.too_close(cars) == []


def test_too_close_marks_flat_metric():
    cars = [car(f"140{i}", 0.0, on_time_pct=90.0 + i * 0.1, games_played_pct=40.0 + i * 10) for i in range(6)]
    out = publish.add_percentiles("orange", cars)
    close = publish.too_close(out)
    assert "on_time_pct" in close and "games_played_pct" not in close
    # A close race is still ranked: the site only notes how bunched the cars are.
    assert all(c["pct"]["on_time_pct"] is not None for c in out)
    assert all(c["pct"]["games_played_pct"] is not None for c in out)


def test_spread_is_p10_to_p90_width():
    cars = publish.add_percentiles("orange", [car(f"140{i}", 0.0, on_time_pct=90.0 + i * 0.1) for i in range(6)])
    sp = publish.spread(cars)
    assert set(sp) == set(publish.MIN_SPREAD)
    assert sp["on_time_pct"] == pytest.approx(0.56)  # statistics.quantiles(n=10), exclusive method, of 90.0..90.5
    assert publish.spread(cars[:2])["on_time_pct"] is None  # too few cars to measure


def test_spread_empty_when_nothing_ranked():
    assert publish.spread(publish.add_percentiles("mattapan", [car("3087", 1)])) == {}


def test_too_close_with_few_cars():
    out = publish.add_percentiles("orange", [car("1400", 0.0, on_time_pct=50.0), car("1401", 500.0, on_time_pct=99.0)])
    assert set(publish.too_close(out)) == set(publish.MIN_SPREAD)


def test_group_file_has_typical_and_threshold(tmp_path):
    out = build(tmp_path)
    g = load(out / "data/last30/groups/orange.json")
    assert g["qualify_min_trips"] == 50 and "averages" not in g
    assert g["typical"]["travel_time_sec"] is not None
    assert g["segs_per_trip"] == 1
    assert isinstance(g["too_close"], list) and "travel_time_sec" in g["too_close"]  # only two cars
    by = {c["number"]: c for c in g["cars"]}
    assert by["1400"]["travel_vs_typical_sec"] == -by["1401"]["travel_vs_typical_sec"] < 0
    assert all("segs_per_trip" not in c for c in g["cars"])
    assert set(g["typical"]) == {"travel_time_sec", "dwell_time_sec"}
    fl = load(out / "data/fleets/orange.json")["last30"]
    for f in fl.values():
        for m in ("travel_vs_typical_sec", "dwell_vs_typical_sec", "travel_vs_typical_pct"):
            assert m in f["median"]
    assert "travel_vs_typical_sec" not in publish.METRICS


def test_group_summary_is_the_small_version_of_the_group_file(tmp_path):
    out = build(tmp_path)
    g = load(out / "data/last30/groups/orange.json")
    sm = load(out / "data/last30/groups/orange.summary.json")
    assert set(sm) == {"group", "window", "generated_at", "qualify_min_trips", "ranked_cars", "segs_per_trip",
                       "typical", "too_close", "spread", "trip_len_sec", "trips_per_day", "tar_replacement"}
    assert sm["group"] == "orange" and sm["window"] == "last30"
    assert sm["typical"] == g["typical"] and sm["qualify_min_trips"] == g["qualify_min_trips"]
    assert sm["too_close"] == g["too_close"] and sm["segs_per_trip"] == g["segs_per_trip"]
    assert sm["spread"] == g["spread"] and set(g["spread"]) == set(publish.MIN_SPREAD)
    assert sm["ranked_cars"] == sum(1 for c in g["cars"] if c["qualified"] and c["ranked"]) == 2
    assert (out / "data/last30/groups/orange.summary.json").stat().st_size < 1000


def test_publish_clears_stale_output(tmp_path):
    out = tmp_path / "out"
    stale = out / "data/2026/cars/blue/WORK.json"
    stale.parent.mkdir(parents=True)
    stale.write_text("{}")
    keep = out / "index.html"
    keep.write_text("<html>")
    out = build(tmp_path)
    assert not stale.exists()
    assert keep.exists()
    assert (out / "data/meta.json").exists()



def test_route_boards_and_index(tmp_path):
    out = build(tmp_path)
    board = load(out / "data/last30/routes/1.json")
    assert board["group"] == "bus" and board["route"] == "1" and board["window"] == "last30"
    assert board["qualify_min_trips"] == 20
    cars = {c["number"]: c for c in board["cars"]}
    assert set(cars) == {"1400", "1401"}
    assert cars["1400"]["car_id"] == "bus:1400" and cars["1400"]["vehicle"]["fleet_label"]
    assert cars["1400"]["travel_vs_typical_sec"] < 0 < cars["1401"]["travel_vs_typical_sec"]
    assert "segs_per_trip" not in cars["1400"]
    assert cars["1400"]["routes"] is None and cars["1400"]["teammates"] == []
    assert "averages" not in board and board["segs_per_trip"] == 1
    assert board["typical"]["travel_time_sec"] is not None and "travel_time_sec" in board["too_close"]
    assert "spread" in board
    assert load(out / "data/last30/routes/index.json") == [{"route": "1", "buses": 2, "ranked_cars": 2, "trips": 100}]
    # The per-route rows live only in the route files.
    assert "by_route" not in load(out / "data/last30/cars/bus/1400.json")
    assert all("by_route" not in c for c in load(out / "data/last30/groups/bus.json")["cars"])
    assert not (out / "data/last30/routes/Orange.json").exists()


def entry(group, number, vs, qualified=True, ranked=True):
    return {"car_id": f"{group}:{number}", "group": group, "number": number, "fleet_label": "F",
            "qualified": qualified, "ranked": ranked, "travel_vs_typical_sec": vs, "pct_travel": 50,
            "tar": None if vs is None else -vs * 10, "pct_tar": 50}


def test_default_seasons_prefer_newest_ranked_year():
    from savant.stats import Window
    wins = [Window("last30", D0, D0), Window("2026", D0, D0), Window("2025", D0, D0)]
    idx = {
        "last30": [entry("red", "1", 0), entry("mattapan", "3087", 0)],
        "2026": [entry("red", "1", 0, qualified=False)],
        "2025": [entry("red", "1", 0)],
    }
    seasons = publish.default_seasons(wins, idx)
    assert seasons["red"] == "2025"  # 2026 has no qualified red car
    assert seasons["mattapan"] == "last30"  # never ranked
    assert seasons["bus"] == "last30"  # no data at all still gets a season


def test_home_cards_top_leaders_or_every_car():
    idx = {"2026": [entry("red", n, vs) for n, vs in (("1", 1), ("2", -4), ("3", -1), ("5", -3), ("6", -2), ("7", -5),
                                                    ("8", None))]
                   + [entry("red", "4", -9, qualified=False)]
                   + [entry("mattapan", n, -1) for n in ("3230", "3087")]}
    cards = publish.home_cards({"red": "2026", "mattapan": "2026", "blue": "2026"}, idx)
    assert [e["number"] for e in cards["red"]["leaders"]] == ["7", "2", "5", "6", "3"]
    assert cards["red"]["cars"] == [] and cards["red"]["season"] == "2026"
    assert cards["mattapan"] == {"season": "2026", "leaders": [], "cars": ["3087", "3230"]}
    assert "blue" not in cards


def test_meta_has_default_seasons_and_home_file(tmp_path):
    out = build(tmp_path)
    meta = load(out / "data/meta.json")
    assert meta["default_season"]["orange"] == "2026" and meta["default_season"]["bus"] == "2026"
    home = load(out / "data/home.json")
    assert set(home) == {"orange", "bus"}
    # two cars: no replacement level, so no TAR and no leaders; every car is listed instead
    assert home["orange"]["leaders"] == [] and home["orange"]["cars"] == ["1400", "1401"]
    orange = load(out / "data/last30/cars/orange/1400.json")
    assert orange["tar"] is None and orange["tar_parts"] is None
    assert orange["new_delivery"] is False  # first seen on the data's first day: already running, not a new delivery


def test_last_seen_on_car_board_and_route_files(tmp_path):
    out = build(tmp_path)
    assert load(out / "data/last30/cars/orange/1400.json")["last_seen"] == "2026-03-02"
    assert all(c["last_seen"] == "2026-03-02" for c in load(out / "data/last30/groups/bus.json")["cars"])
    assert all(c["last_seen"] == "2026-03-02" for c in load(out / "data/last30/routes/1.json")["cars"])


def test_tar_is_a_higher_is_better_metric():
    assert publish.METRICS["tar"] == "higher" and publish.MIN_SPREAD["tar"] == 100


def test_tar_non_null_with_enough_ranked_cars(tmp_path):
    root = tmp_path / "root"
    nums = ["1400", "1401", "1402", "1403", "1404", "1405"]
    for group, route in (("orange", "Orange"), ("bus", "1")):
        segs = [seg(D0, f"{n}-{i}", [n], 100 + 5 * k, group, route)
                for i in range(50) for k, n in enumerate(nums)]
        write_day(segs, root, group, D0)
    out = tmp_path / "out"
    publish.publish(root, out)
    g = load(out / "data/last30/groups/orange.json")
    ranked = [c for c in g["cars"] if c["ranked"] and c["qualified"]]
    assert len(ranked) >= 5
    assert all(c["tar"] is not None and set(c["tar_parts"]) == {"field", "speed", "steady"} for c in ranked)
    assert g["trips_per_day"] > 0 and g["tar_replacement"]["service_share"] is not None
    assert g["tar_replacement"]["fast_sec"] is not None
    idx = load(out / "data/last30/index.json")
    assert any(e["tar"] is not None for e in idx)
    rb = load(out / "data/last30/routes/1.json")
    assert rb["tar_replacement"]["fast_sec"] is not None
    assert any(c["tar"] is not None for c in rb["cars"])


# --- career window and frozen years ---

Y1, Y2 = date(2024, 3, 4), date(2025, 3, 3)


def two_years(tmp_path, days=(Y1, Y2), name="root"):
    """Orange and bus segments for 1400/1401 on each of ``days`` (one service day per year)."""
    root = tmp_path / name
    for group, route in (("orange", "Orange"), ("bus", "1")):
        for day in days:
            segs = [seg(day, f"{n}-{i}", [n], t, group, route)
                    for i in range(50) for n, t in (("1400", 100), ("1401", 110))]
            write_day(segs, root, group, day)
    return root


def tree(data):
    """Every JSON file under ``data`` by relative path, with build timestamps dropped."""
    out = {}
    for p in sorted(data.rglob("*.json")):
        obj = load(p)
        if isinstance(obj, dict):
            obj = {k: v for k, v in obj.items() if k not in ("generated_at", "built_at")}
        out[str(p.relative_to(data))] = obj
    return out


def test_career_min_spread_trip_time_in_points():
    assert publish.CAREER_MIN_SPREAD == {**publish.MIN_SPREAD, "travel_time_sec": 0.5}
    cars = publish.add_percentiles("orange", [car(f"140{i}", i * 0.2) for i in range(6)])  # spread ~1.1
    assert "travel_time_sec" in publish.too_close(cars)
    assert "travel_time_sec" not in publish.too_close(cars, publish.CAREER_MIN_SPREAD)
    assert set(publish.spread(cars, publish.CAREER_MIN_SPREAD)) == set(publish.CAREER_MIN_SPREAD)


def test_build_writes_career(tmp_path):
    out = tmp_path / "out"
    publish.publish(two_years(tmp_path), out)
    d = out / "data"
    g = load(d / "career/groups/orange.json")
    assert g["window"] == "career" and g["group"] == "orange"
    assert g["typical"] == {"travel_time_sec": 0, "dwell_time_sec": 0}
    assert all(not {"seasons", "windows", "game_log"} & set(c) for c in g["cars"])
    sm = load(d / "career/groups/orange.summary.json")
    assert sm["typical"] == {"travel_time_sec": 0, "dwell_time_sec": 0} and sm["ranked_cars"] == 2
    assert set(sm["spread"]) == set(publish.CAREER_MIN_SPREAD) and isinstance(sm["too_close"], list)
    assert sm["qualify_min_trips"] == g["qualify_min_trips"]
    c = load(d / "career/cars/orange/1400.json")
    assert len(c["seasons"]) == 2 and c["windows"] == ["2025", "2024"]
    assert c["trips"] == 100 and c["seasons_played"] == 2
    assert c["game_log"] == [] and c["teammates"] == []
    assert c["vehicle"]["fleet_label"] and c["ranked"] is True and c["qualified"] is True
    assert c["last_seen"] == "2025-03-03" and c["first_seen"] == "2024-03-04"
    assert set(c["pct"]) == set(publish.METRICS) and c["pct"]["travel_time_sec"] is not None
    bus = load(d / "career/cars/bus/1400.json")
    assert bus["routes"] == 1 and bus["game_log"] == []
    idx = load(d / "career/index.json")
    assert {e["car_id"] for e in idx} == {"orange:1400", "orange:1401", "bus:1400", "bus:1401"}
    assert "career" in load(d / "fleets/orange.json")
    assert not (d / "career/routes").exists()
    meta = load(d / "meta.json")
    assert meta["windows"][0] == {"key": "career", "start": "2024-03-04", "end": "2025-03-03"}
    assert [w["key"] for w in meta["windows"]] == ["career", "last30", "2025", "2024"]
    assert meta["default_season"]["orange"] == "2025"
    assert all(v.isdigit() or v == "last30" for v in meta["default_season"].values())
    assert all(card["season"] != "career" for card in load(d / "home.json").values())


def test_closed_year_gets_frozen_marker(tmp_path):
    out = tmp_path / "out"
    publish.publish(two_years(tmp_path), out)
    marker = load(out / "data/2024/frozen.json")
    assert marker["through"] == "2024-12-31" and "built_at" in marker
    assert not (out / "data/2025/frozen.json").exists()
    assert not (out / "data/last30/frozen.json").exists()


@pytest.mark.parametrize(("latest", "closed"), [(date(2027, 1, 6), False), (date(2027, 1, 7), True)])
def test_closed_boundary(tmp_path, latest, closed):
    out = tmp_path / "out"
    publish.publish(two_years(tmp_path, days=(date(2026, 6, 1), latest)), out)
    assert (out / "data/2026/frozen.json").exists() is closed


def test_frozen_year_copied(tmp_path):
    root = two_years(tmp_path)
    first = tmp_path / "first"
    publish.publish(root, first)
    frozen = tmp_path / "frozen"
    shutil.copytree(first / "data", frozen)
    f = frozen / "2024/cars/orange/1400.json"
    rec = load(f)
    rec["miles"] = 9999.0
    f.write_text(json.dumps(rec))
    out = tmp_path / "out"
    publish.publish(root, out, frozen=frozen)
    assert (out / "data/2024/cars/orange/1400.json").read_bytes() == f.read_bytes()
    assert (out / "data/2024/frozen.json").exists()
    career = load(out / "data/career/cars/orange/1400.json")
    y2025 = load(out / "data/2025/cars/orange/1400.json")
    assert career["miles"] == 9999.0 + y2025["miles"]
    assert [s["miles"] for s in career["seasons"]] == [y2025["miles"], 9999.0]
    # The frozen year's index and fleet entries come from the copy.
    assert load(out / "data/fleets/orange.json")["2024"] == load(frozen / "fleets/orange.json")["2024"]
    assert load(out / "data/2024/index.json") == load(frozen / "2024/index.json")
    assert tree(out / "data")["2025/cars/orange/1400.json"] == tree(first / "data")["2025/cars/orange/1400.json"]


def test_frozen_year_group_file_gets_fresh_last_seen(tmp_path):
    root = two_years(tmp_path)
    first = tmp_path / "first"
    publish.publish(root, first)
    frozen = tmp_path / "frozen"
    shutil.copytree(first / "data", frozen)
    gf = frozen / "2024/groups/orange.json"
    board = load(gf)
    fresh = {c["number"]: c["last_seen"] for c in board["cars"]}
    assert fresh and all(v is not None for v in fresh.values())
    for c in board["cars"]:
        c["last_seen"] = "1999-01-01"
    gf.write_text(json.dumps(board))
    out = tmp_path / "out"
    publish.publish(root, out, frozen=frozen)
    copied = load(out / "data/2024/groups/orange.json")
    assert {c["number"]: c["last_seen"] for c in copied["cars"]} == fresh
    assert {k: v for k, v in copied.items() if k != "cars"} == {k: v for k, v in board.items() if k != "cars"}
    car = "2024/cars/orange/1400.json"
    assert (out / "data" / car).read_bytes() == (frozen / car).read_bytes()


def test_frozen_year_fleet_rebuilt_when_fleets_file_missing(tmp_path):
    root = two_years(tmp_path)
    first = tmp_path / "first"
    publish.publish(root, first)
    frozen = tmp_path / "frozen"
    shutil.copytree(first / "data", frozen)
    shutil.rmtree(frozen / "fleets")
    out = tmp_path / "out"
    publish.publish(root, out, frozen=frozen)
    assert load(out / "data/fleets/orange.json")["2024"] == load(first / "data/fleets/orange.json")["2024"]


def test_unmarked_year_recomputed(tmp_path):
    root = two_years(tmp_path)
    first = tmp_path / "first"
    publish.publish(root, first)
    frozen = tmp_path / "frozen"
    shutil.copytree(first / "data", frozen)
    (frozen / "2024/frozen.json").unlink()
    f = frozen / "2024/cars/orange/1400.json"
    f.write_text(json.dumps({**load(f), "miles": 9999.0}))
    out = tmp_path / "out"
    publish.publish(root, out, frozen=frozen)
    assert tree(out / "data") == tree(first / "data")


@pytest.mark.parametrize("make", [True, False])
def test_frozen_dir_empty_recomputes(tmp_path, make):
    root = two_years(tmp_path)
    plain = tmp_path / "plain"
    publish.publish(root, plain)
    frozen = tmp_path / "frozen"
    if make:
        frozen.mkdir()
    out = tmp_path / "out"
    publish.publish(root, out, frozen=frozen)
    assert tree(out / "data") == tree(plain / "data")


def test_frozen_inside_output_rejected(tmp_path):
    root = two_years(tmp_path)
    out = tmp_path / "out"
    publish.publish(root, out)
    with pytest.raises(ValueError):
        publish.publish(root, out, frozen=out / "data")
    assert (out / "data/2024/frozen.json").exists()  # nothing deleted
