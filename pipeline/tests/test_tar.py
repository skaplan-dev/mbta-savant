import statistics

from savant import tar

SHARES = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0]


def mk(i, share=0.8, fast=10.0, steady=-5.0, ranked=True, qualified=True, eligible=100, trips=None):
    return {"number": str(i), "ranked": ranked, "qualified": qualified, "eligible_days": eligible,
            "service_days": share * eligible, "trips": share * eligible * 20 if trips is None else trips,
            "travel_vs_typical_sec": -fast, "dwell_vs_typical_sec": 0.0, "steady_adj_sec": steady}


def q20(v):
    return statistics.quantiles(v, n=5)[0]


def test_field_part():
    cars = [mk(i, share=s) for i, s in enumerate(SHARES)]
    out = tar.add_tar(cars, 1500.0, 16.0)
    assert out["trips_per_day"] == 20
    assert cars[-1]["tar_parts"]["field"] == round((1.0 - q20(SHARES)) * 100 * 20)
    assert all(c["tar_parts"]["speed"] == 0 and c["tar_parts"]["steady"] == 0 for c in cars)


def test_speed_part():
    fasts = [0, 10, 20, 30, 40, 50]
    cars = [mk(i, share=0.8, fast=f, trips=4000) for i, f in enumerate(fasts)]
    tar.add_tar(cars, 1500.0, 16.0)
    for c, f in zip(cars, fasts):
        assert c["tar_parts"]["speed"] == round((f - q20(fasts)) * 4000 / 1500)


def test_steady_part_uses_segments():
    st = [-10, -8, -6, -4, -2, 0]
    cars = [mk(i, share=0.8, steady=s, trips=4000) for i, s in enumerate(st)]
    tar.add_tar(cars, 1500.0, 16.0)
    for c, s in zip(cars, st):
        assert c["tar_parts"]["steady"] == round((s - q20(st)) * 16 * 4000 / 1500)


def test_null_input_is_zero_part():
    st = [-10, -8, -6, -4, -2]
    cars = [mk(i, steady=s, trips=4000) for i, s in enumerate(st)] + [mk(9, steady=None, trips=4000)]
    out = tar.add_tar(cars, 1500.0, 16.0)
    assert cars[-1]["tar_parts"]["steady"] == 0
    assert out["tar_replacement"]["steady_adj_sec"] == q20(st)


def test_few_cars_have_no_tar():
    cars = [mk(i, share=s, fast=s * 10) for i, s in enumerate(SHARES[:3])]
    tar.add_tar(cars, 1500.0, 16.0)
    assert all(c["tar"] is None and c["tar_parts"] is None for c in cars)


def test_unranked_get_none():
    cars = [mk(i, share=s) for i, s in enumerate(SHARES)] + [mk(9, ranked=False), mk(10, qualified=False)]
    tar.add_tar(cars, 1500.0, 16.0)
    assert all(c["tar"] is None and c["tar_parts"] is None for c in cars[-2:])


def test_zero_service_days_ignored_in_trips_per_day():
    cars = [mk(i, share=s) for i, s in enumerate(SHARES)] + [mk(9, share=0.0, eligible=0, trips=0)]
    out = tar.add_tar(cars, 1500.0, 16.0)
    assert out["trips_per_day"] == 20
