"""TAR (Trips Above Replacement): how many trips a car was worth over a replacement car.

Per ranked, qualified car, three parts (field, speed, steady) are each measured against a replacement value
(the 20th percentile over ranked, qualified cars that have the input) and converted to trips:

    field  = (service_share - repl_share) * eligible_days * trips_per_day
    speed  = (fast_sec - repl_fast) * trips / trip_len_sec
    steady = (steady_adj_sec - repl_steady) * segs_per_trip * trips / trip_len_sec

A missing input, or fewer than MIN_CARS cars having it, makes that part 0; if all three replacement values are
missing, ``tar`` and ``tar_parts`` are None (nothing to measure against). Unranked or unqualified cars
(and all of Mattapan) get ``tar`` and ``tar_parts`` of None.
"""

import statistics

MIN_CARS = 5


def _eligible(c: dict) -> bool:
    return bool(c.get("ranked") and c.get("qualified"))


def _share(c: dict) -> float | None:
    elig = c.get("eligible_days")
    sd = c.get("service_days")
    return sd / elig if elig and sd is not None else None


def _fast(c: dict) -> float | None:
    t = c.get("travel_vs_typical_sec")
    return None if t is None else -(t + (c.get("dwell_vs_typical_sec") or 0))


def _repl(values: list[float]) -> float | None:
    return statistics.quantiles(values, n=5)[0] if len(values) >= MIN_CARS else None


def add_tar(cars: list[dict], trip_len_sec: float | None, segs_per_trip: float | None) -> dict:
    """Set ``tar`` and ``tar_parts`` on each car in place; return {"trips_per_day", "tar_replacement"}."""
    pool = [c for c in cars if _eligible(c)]
    rates = [c["trips"] / c["service_days"] for c in pool if c.get("service_days") and c.get("trips") is not None]
    trips_per_day = statistics.median(rates) if rates else None
    inputs = {
        "service_share": _share,
        "fast_sec": _fast,
        "steady_adj_sec": lambda c: c.get("steady_adj_sec"),
    }
    repl = {}
    for name, get in inputs.items():
        repl[name] = _repl([v for v in (get(c) for c in pool) if v is not None])
    no_repl = all(v is None for v in repl.values())
    for c in cars:
        if no_repl or not _eligible(c):
            c["tar"], c["tar_parts"] = None, None
            continue
        trips = c.get("trips") or 0
        share, fast, steady = _share(c), _fast(c), c.get("steady_adj_sec")
        field = speed = steady_t = 0.0
        if share is not None and repl["service_share"] is not None and trips_per_day is not None:
            field = (share - repl["service_share"]) * c["eligible_days"] * trips_per_day
        if fast is not None and repl["fast_sec"] is not None and trip_len_sec:
            speed = (fast - repl["fast_sec"]) * trips / trip_len_sec
        if steady is not None and repl["steady_adj_sec"] is not None and trip_len_sec and segs_per_trip:
            steady_t = (steady - repl["steady_adj_sec"]) * segs_per_trip * trips / trip_len_sec
        c["tar"] = round(field + speed + steady_t)
        c["tar_parts"] = {"field": round(field), "speed": round(speed), "steady": round(steady_t)}
    return {"trips_per_day": trips_per_day, "tar_replacement": repl}
