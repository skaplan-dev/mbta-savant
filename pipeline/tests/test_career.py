from savant import career


def rec(number, group="orange", trips=100, qualified=True, pct=None, fleet="Orange #14", **kw):
    """A published season car record (the fields career reads)."""
    base = {
        "car_id": f"{group}:{number}", "number": number, "trips": trips, "miles": 1000.0,
        "service_days": 10, "eligible_days": 20, "games_played_pct": 50.0, "iron_horse_days": 3,
        "on_time_pct": None, "steadiness_sec": None, "crowd_load_pct": None,
        "travel_vs_typical_sec": None, "dwell_vs_typical_sec": None, "travel_vs_typical_pct": None,
        "tar": None, "tar_parts": None, "qualified": qualified, "ranked": True,
        "pct": pct or {"travel_time_sec": None, "tar": None},
        "vehicle": {"fleet_label": fleet}, "routes": None,
    }
    base.update(kw)
    return base


def one(group, seasons, number="1400"):
    return next(c for c in career.career_cars(group, seasons) if c["number"] == number)


def test_career_key():
    assert career.CAREER == "career"


def test_trip_weighted_vs_typical_pct_is_travel_time():
    c = one("orange", {
        "2024": [rec("1400", trips=100, travel_vs_typical_pct=2.0)],
        "2025": [rec("1400", trips=300, travel_vs_typical_pct=-2.0)],
    })
    assert c["travel_vs_typical_pct"] == -1.0
    assert c["travel_time_sec"] == -1.0


def test_dwell_time_is_career_dwell_vs_typical():
    c = one("orange", {
        "2024": [rec("1400", trips=100, dwell_vs_typical_sec=4.0, travel_vs_typical_sec=10.0)],
        "2025": [rec("1400", trips=300, dwell_vs_typical_sec=0.0, travel_vs_typical_sec=-10.0)],
    })
    assert c["dwell_vs_typical_sec"] == 1.0 and c["dwell_time_sec"] == 1.0
    assert c["travel_vs_typical_sec"] == -5.0


def test_counting_stats_summed_and_games_played_from_totals():
    c = one("orange", {
        "2024": [rec("1400", trips=100, miles=500.0, service_days=30, eligible_days=100, iron_horse_days=7)],
        "2025": [rec("1400", trips=300, miles=1500.0, service_days=90, eligible_days=100, iron_horse_days=4)],
    })
    assert (c["trips"], c["miles"], c["service_days"], c["eligible_days"]) == (400, 2000.0, 120, 200)
    assert c["games_played_pct"] == 60.0
    assert c["iron_horse_days"] == 7


def test_miles_none_when_every_season_none():
    c = one("bus", {"2024": [rec("1400", group="bus", miles=None)], "2025": [rec("1400", group="bus", miles=None)]})
    assert c["miles"] is None


def test_tar_summed_over_non_null_seasons():
    c = one("orange", {
        "2023": [rec("1400", tar=None, tar_parts=None)],
        "2024": [rec("1400", tar=100, tar_parts={"field": 80, "speed": 15, "steady": 5})],
        "2025": [rec("1400", tar=-20, tar_parts={"field": 10, "speed": -25, "steady": -5})],
    })
    assert c["tar"] == 80
    assert c["tar_parts"] == {"field": 90, "speed": -10, "steady": 0}


def test_tar_none_when_every_season_none():
    c = one("orange", {"2024": [rec("1400")], "2025": [rec("1400")]})
    assert c["tar"] is None and c["tar_parts"] is None


def test_weighted_means_skip_none_and_renormalise():
    c = one("orange", {
        "2023": [rec("1400", trips=1000, on_time_pct=None, steadiness_sec=None)],
        "2024": [rec("1400", trips=100, on_time_pct=90.0, steadiness_sec=10.0)],
        "2025": [rec("1400", trips=300, on_time_pct=70.0, steadiness_sec=None)],
    })
    assert c["on_time_pct"] == 75.0
    assert c["steadiness_sec"] == 10.0
    assert c["crowd_load_pct"] is None
    assert c["travel_vs_typical_pct"] is None and c["travel_time_sec"] is None


def test_qualified_needs_threshold_and_a_qualified_season():
    seasons = {
        "2024": [rec("1400", trips=1000, qualified=False), rec("1401", trips=1000), rec("1402", trips=10)],
        "2025": [rec("1400", trips=1000, qualified=False), rec("1401", trips=1000), rec("1402", trips=10)],
    }
    out = {c["number"]: c for c in career.career_cars("orange", seasons)}
    assert out["1400"]["qualified"] is False  # high trips but never qualified in a season
    assert out["1401"]["qualified"] is True
    assert out["1402"]["qualified"] is False  # qualified in seasons but below the career threshold (50)


def test_career_car_missing_years():
    seasons = {"2024": [rec("1401")], "2025": [rec("1401")], "2026": [rec("1400"), rec("1401")]}
    out = {c["number"]: c for c in career.career_cars("orange", seasons)}
    assert out["1400"]["seasons_played"] == 1 and out["1400"]["windows"] == ["2026"]
    assert out["1401"]["seasons_played"] == 3 and out["1401"]["windows"] == ["2026", "2025", "2024"]
    assert out["1400"]["car_id"] == "orange:1400"


def test_bus_routes_union_of_game_log_routes():
    c = one("bus", {
        "2024": [rec("1400", group="bus", routes=2, game_log=[
            {"date": "2024-01-01", "trips": 3, "routes": ["1", "39"]},
            {"date": "2024-01-02", "trips": 3, "routes": ["39"]}])],
        "2025": [rec("1400", group="bus", routes=2, game_log=[{"date": "2025-01-01", "trips": 3, "routes": ["1", "66"]}])],
    })
    assert c["routes"] == 3


def test_bus_routes_without_game_log_uses_max():
    c = one("bus", {"2024": [rec("1400", group="bus", routes=2)], "2025": [rec("1400", group="bus", routes=5)]})
    assert c["routes"] == 5


def test_rail_routes_none():
    c = one("red", {"2025": [rec("1500", group="red", game_log=[{"date": "2025-01-01", "trips": 3, "routes": ["Red"]}])]},
            number="1500")
    assert c["routes"] is None


def test_career_omits_build_fields_and_sets_teammates_empty():
    c = one("orange", {"2025": [rec("1400", teammates=[["1401", 5]], game_log=[])]})
    assert c["teammates"] == []
    for k in ("vehicle", "ranked", "first_seen", "last_seen", "new_delivery", "pct", "game_log", "by_route"):
        assert k not in c


def test_seasons_rows_newest_first():
    c = one("orange", {
        "2024": [rec("1400", trips=100, qualified=False, ranked=False, travel_vs_typical_sec=3.0,
                     travel_vs_typical_pct=0.5, on_time_pct=80.0, tar=10,
                     pct={"travel_time_sec": 40, "tar": 55}, fleet="Orange #12")],
        "2025": [rec("1400", trips=300, travel_vs_typical_sec=-3.0, travel_vs_typical_pct=-0.5,
                     on_time_pct=90.0, tar=20, pct={"travel_time_sec": 70, "tar": 65})],
    })
    assert [r["season"] for r in c["seasons"]] == ["2025", "2024"]
    assert c["seasons"][1] == {
        "season": "2024", "trips": 100, "qualified": False, "ranked": False, "travel_vs_typical_sec": 3.0,
        "travel_vs_typical_pct": 0.5, "pct_travel": 40, "on_time_pct": 80.0, "games_played_pct": 50.0,
        "miles": 1000.0, "iron_horse_days": 3, "tar": 10, "pct_tar": 55, "fleet_label": "Orange #12",
    }


def test_season_row_tolerates_missing_pct_and_vehicle():
    r = career.season_row("2025", {"trips": 5, "qualified": False})
    assert r["pct_travel"] is None and r["pct_tar"] is None and r["fleet_label"] is None and r["ranked"] is None


def test_seasons_played_counts_only_seasons_with_trips():
    c = one("orange", {"2024": [rec("1400", trips=0, qualified=False)], "2025": [rec("1400", trips=100)]})
    assert c["seasons_played"] == 1
    assert c["windows"] == ["2025", "2024"]


def test_bus_routes_mixed_game_log_never_below_a_season_count():
    c = one("bus", {
        "2024": [rec("1400", group="bus", routes=6)],  # game_log stripped
        "2025": [rec("1400", group="bus", routes=2, game_log=[{"date": "2025-01-01", "trips": 3, "routes": ["1", "66"]}])],
    })
    assert c["routes"] == 6
    c = one("bus", {
        "2024": [rec("1400", group="bus", routes=1)],
        "2025": [rec("1400", group="bus", routes=2, game_log=[
            {"date": "2025-01-01", "trips": 3, "routes": ["1", "66"]},
            {"date": "2025-01-02", "trips": 3, "routes": ["39"]}])],
    })
    assert c["routes"] == 3


def test_games_played_pairs_service_and_eligible_days():
    c = one("orange", {
        "2024": [rec("1400", service_days=None, eligible_days=100)],
        "2025": [rec("1400", service_days=30, eligible_days=60)],
        "2026": [rec("1400", service_days=40, eligible_days=None)],
    })
    assert c["games_played_pct"] == 50.0
