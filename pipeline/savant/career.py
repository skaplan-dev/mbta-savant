"""Career ("All-time") records for one ranking group, built from its year-window (season) car records.

Each season was already ranked against its own year, so the career is era-fair: rate stats are trip-weighted
means of season values (seasons with no value are skipped and the weights renormalised), counting stats are
sums, and the trip-time stat is the career ``travel_vs_typical_pct`` (a percentage is fair across eras with
different trip lengths). See docs/superpowers/specs/2026-11-26-history-and-career-design.md section 4.

Publish sets ``vehicle``, ``ranked``, ``first_seen``, ``last_seen``, ``new_delivery`` and ``pct`` on the
returned records from the current build, so they are not set here. This module must not import publish.
"""

from savant import stats

CAREER = "career"

# Career value -> trip-weighted mean of this season field.
_WEIGHTED = {
    "travel_vs_typical_pct": "travel_vs_typical_pct",
    "travel_vs_typical_sec": "travel_vs_typical_sec",
    "dwell_vs_typical_sec": "dwell_vs_typical_sec",
    "on_time_pct": "on_time_pct",
    "steadiness_sec": "steadiness_sec",
    "crowd_load_pct": "crowd_load_pct",
}
_SUMMED = ("trips", "miles", "service_days", "eligible_days")


def season_row(season: str, car: dict) -> dict:
    """One row of a car's season history."""
    pct = car.get("pct") or {}
    vehicle = car.get("vehicle") or {}
    return {
        "season": season,
        "trips": car.get("trips"),
        "qualified": car.get("qualified"),
        "ranked": car.get("ranked"),
        "travel_vs_typical_sec": car.get("travel_vs_typical_sec"),
        "travel_vs_typical_pct": car.get("travel_vs_typical_pct"),
        "pct_travel": pct.get("travel_time_sec"),
        "on_time_pct": car.get("on_time_pct"),
        "games_played_pct": car.get("games_played_pct"),
        "miles": car.get("miles"),
        "iron_horse_days": car.get("iron_horse_days"),
        "tar": car.get("tar"),
        "pct_tar": pct.get("tar"),
        "fleet_label": vehicle.get("fleet_label"),
    }


def _sum(values: list) -> float | int | None:
    present = [v for v in values if v is not None]
    return sum(present) if present else None


def _weighted_mean(recs: list[dict], field: str) -> float | None:
    pairs = [(r[field], r.get("trips") or 0) for r in recs if r.get(field) is not None]
    total = sum(w for _, w in pairs)
    if not total:
        return None
    return sum(v * w for v, w in pairs) / total


def _tar_parts(recs: list[dict]) -> dict[str, int] | None:
    parts = [r["tar_parts"] for r in recs if r.get("tar_parts")]
    if not parts:
        return None
    out: dict[str, int] = {}
    for p in parts:
        for k, v in p.items():
            out[k] = out.get(k, 0) + (v or 0)
    return out


def _routes(group: str, recs: list[dict]) -> int | None:
    """Bus: distinct routes over the seasons' game-log route lists, never below any season's own route count."""
    if group != "bus":
        return None
    seen: set[str] = set()
    for r in recs:
        for day in r.get("game_log") or []:
            if day.get("routes") is not None:
                seen.update(day["routes"])
    counts = [r["routes"] for r in recs if r.get("routes") is not None]
    if not seen and not counts:
        return None
    return max(len(seen), *counts) if counts else len(seen)


def _career(group: str, number: str, by_season: list[tuple[str, dict]]) -> dict:
    """by_season: (season key, record) newest first."""
    recs = [r for _, r in by_season]
    totals = {f: _sum([r.get(f) for r in recs]) for f in _SUMMED}
    means = {k: _weighted_mean(recs, f) for k, f in _WEIGHTED.items()}
    paired = [r for r in recs if r.get("service_days") is not None and r.get("eligible_days") is not None]
    service, eligible = sum(r["service_days"] for r in paired), sum(r["eligible_days"] for r in paired)
    horse = [r["iron_horse_days"] for r in recs if r.get("iron_horse_days") is not None]
    return {
        "car_id": f"{group}:{number}",
        "number": number,
        **totals,
        "trips": totals["trips"] or 0,
        "games_played_pct": 100.0 * service / eligible if eligible else None,
        "iron_horse_days": max(horse) if horse else None,
        **means,
        "travel_time_sec": means["travel_vs_typical_pct"],
        "dwell_time_sec": means["dwell_vs_typical_sec"],
        "tar": _sum([r.get("tar") for r in recs]),
        "tar_parts": _tar_parts(recs),
        "routes": _routes(group, recs),
        "teammates": [],
        "seasons_played": sum(1 for r in recs if (r.get("trips") or 0) > 0),
        "any_qualified": any(r.get("qualified") for r in recs),
        "seasons": [season_row(s, r) for s, r in by_season],
        "windows": [s for s, _ in by_season],
    }


def career_cars(group: str, seasons: dict[str, list[dict]]) -> list[dict]:
    """One career record per car number seen in any season. ``seasons``: year key -> that year's car records."""
    per_car: dict[str, list[tuple[str, dict]]] = {}
    for season in sorted(seasons, reverse=True):
        for r in seasons[season]:
            per_car.setdefault(r["number"], []).append((season, r))
    cars = [_career(group, number, by_season) for number, by_season in per_car.items()]
    threshold = stats.qualify_threshold([c["trips"] for c in cars])
    for c in cars:
        c["qualified"] = c.pop("any_qualified") and c["trips"] >= threshold
    return sorted(cars, key=lambda c: c["number"])
