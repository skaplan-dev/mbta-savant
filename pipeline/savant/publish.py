"""Percentile ranking and static JSON publishing.

Percentile = 100 * (qualified cars in the group this car strictly beats) / (n - 1), rounded to an int,
where n is the number of qualified cars with a value for the metric. Ties never count as beating, so
tied cars share a percentile. n == 1 gives 100. Unqualified cars, cars missing the metric, unranked
metrics, and the mattapan group get None.

Travel and dwell time are also shown against the group's typical car (``travel_vs_typical_sec``,
``dwell_vs_typical_sec``, ``travel_vs_typical_pct``): the typical car is the
median over qualified, ranked cars. These are display-only; percentiles stay on the absolute fields
(centering does not change rank).

A ranked metric is "too close to call" in a group when the p90 - p10 spread of its value over qualified
ranked cars is below MIN_SPREAD, or fewer than MIN_CARS such cars have it. Its percentiles are None.
"""

import json
import shutil
import statistics
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from savant import roster, stats
from savant.groups import GROUPS

METRICS: dict[str, Literal["higher", "lower"] | None] = {
    "travel_time_sec": "lower",
    "dwell_time_sec": "lower",
    "on_time_pct": "higher",
    "steadiness_sec": "lower",
    "games_played_pct": "higher",
    "iron_horse_days": "higher",
    "miles": "higher",
    "routes": "higher",
    "crowd_load_pct": None,
}
UNRANKED_GROUPS = {"mattapan"}
# centered field -> absolute field it is centered from
VS_TYPICAL = {
    "travel_vs_typical_sec": "travel_time_sec",
    "dwell_vs_typical_sec": "dwell_time_sec",
}
# Smallest p90 - p10 spread at which a metric can separate cars at all.
MIN_SPREAD = {
    "travel_time_sec": 10, "dwell_time_sec": 5, "steadiness_sec": 1.0,
    "on_time_pct": 2.0, "games_played_pct": 5.0, "iron_horse_days": 3,
}
MIN_CARS = 5


def _pool(cars: list[dict], metric: str) -> list[float]:
    return [c[metric] for c in cars if c.get("qualified") and c.get("ranked") and c.get(metric) is not None]


def too_close(cars: list[dict]) -> list[str]:
    """Metrics (with a MIN_SPREAD) whose values are too bunched to rank these cars; [] if no car is ranked."""
    if not any(c.get("ranked") for c in cars):
        return []
    out = []
    for metric, floor in MIN_SPREAD.items():
        vals = _pool(cars, metric)
        if len(vals) < MIN_CARS:
            out.append(metric)
            continue
        cuts = statistics.quantiles(vals, n=10)
        if cuts[-1] - cuts[0] < floor:
            out.append(metric)
    return out


def add_percentiles(group: str, cars: list[dict]) -> list[dict]:
    out = [
        {**c, "pct": {m: None for m in METRICS},
         "ranked": group not in UNRANKED_GROUPS and roster.lookup(group, c["number"]) is not None}
        for c in cars
    ]
    if group in UNRANKED_GROUPS:
        return out
    close = set(too_close(out))
    for metric, direction in METRICS.items():
        if direction is None or metric in close:
            continue
        ranked = [c for c in out if c["ranked"] and c.get("qualified") and c.get(metric) is not None]
        n = len(ranked)
        for c in ranked:
            if n == 1:
                c["pct"][metric] = 100
                continue
            v = c[metric]
            beats = sum(1 for o in ranked if (o[metric] > v if direction == "lower" else o[metric] < v))
            c["pct"][metric] = round(100 * beats / (n - 1))
    return out


def add_vs_typical(cars: list[dict]) -> dict[str, float | None]:
    """Set each car's VS_TYPICAL fields and travel_vs_typical_pct in place; return the typical car's values
    keyed by absolute field. Typical = median over qualified, ranked cars."""
    typical: dict[str, float | None] = {}
    for centered, metric in VS_TYPICAL.items():
        vals = _pool(cars, metric)
        med = statistics.median(vals) if vals else None
        typical[metric] = med
        for c in cars:
            v = c.get(metric)
            c[centered] = None if med is None or v is None else v - med
    for c in cars:
        d, exp = c.get("travel_vs_typical_sec"), c.get("exp_travel_sec")
        c["travel_vs_typical_pct"] = None if d is None or not exp else 100 * d / exp
    return typical


def _write(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, default=str), encoding="utf-8")


def _write_routes(dir_: Path, boards: dict[str, dict]) -> None:
    """routes/<route>.json (a bus line file for one route) and routes/index.json (every route, for the picker)."""
    for route, board in boards.items():
        _write(dir_ / f"{route}.json", board)
    _write(
        dir_ / "index.json",
        [{"route": route, "buses": len(b["cars"]), "ranked_cars": sum(1 for c in b["cars"] if c["qualified"] and c["ranked"]),
          "trips": sum(c["trips"] for c in b["cars"])} for route, b in sorted(boards.items())],
    )


def _fleet(cars: list[dict]) -> dict:
    fleets: dict[str, dict] = {}
    for c in cars:
        if not (c["qualified"] and c["ranked"]):
            continue
        v = c["vehicle"]
        f = fleets.setdefault(v.get("fleet_key", "unknown"), {"fleet_label": v["fleet_label"], "cars": 0, "median": {}})
        f["cars"] += 1
        for m in (*METRICS, *VS_TYPICAL, "travel_vs_typical_pct"):
            if c.get(m) is not None:
                f["median"].setdefault(m, []).append(c[m])
    for f in fleets.values():
        f["median"] = {m: statistics.median(vals) for m, vals in f["median"].items()}
    return fleets


def route_boards(cars: list[dict], window: str, now: str) -> dict[str, dict]:
    """Bus cars (with ``by_route``) -> route -> that route's board, ranked and centered within the route.

    A route board is shaped like a group file plus ``route``, and each of its cars keeps the bus's identity
    (car_id, number, vehicle) with the per-route metrics, so the web renders it with the line leaderboard.
    """
    by_route: dict[str, list[dict]] = {}
    for c in cars:
        for r in c.get("by_route", []):
            by_route.setdefault(r["route"], []).append(
                {"car_id": c["car_id"], "number": c["number"], "last_seen": c.get("last_seen"),
                 **{k: v for k, v in r.items() if k != "route"},
                 "routes": None, "crowd_load_pct": None, "teammates": [], "vehicle": c["vehicle"]}
            )
    boards = {}
    for route, rcars in by_route.items():
        segs = rcars[0].get("segs_per_trip") if rcars else None
        for c in rcars:
            c.pop("segs_per_trip", None)
        rcars = add_percentiles("bus", rcars)
        boards[route] = {"group": "bus", "route": route, "window": window, "generated_at": now,
                         "qualify_min_trips": stats.ROUTE_QUALIFY_MIN_TRIPS, "segs_per_trip": segs,
                         "typical": add_vs_typical(rcars), "too_close": too_close(rcars), "cars": rcars}
    return boards


HOME_LEADERS = 5


def _ranked_entry(group: str, e: dict) -> bool:
    return group not in UNRANKED_GROUPS and e["ranked"] and e["qualified"]


def default_seasons(wins: list[stats.Window], index_by_window: dict[str, list]) -> dict[str, str]:
    """Each group's default season: the newest year with a ranked car, else last30, else the newest window."""
    years = sorted((w.key for w in wins if w.key.isdigit()), reverse=True)
    fallback = "last30" if any(w.key == "last30" for w in wins) else (years[0] if years else None)
    out = {}
    for group in GROUPS:
        hit = next((y for y in years
                    if any(e["group"] == group and _ranked_entry(group, e) for e in index_by_window[y])), None)
        if hit or fallback:
            out[group] = hit or fallback
    return out


def _natural(number: str):
    return (0, int(number), "") if number.isdigit() else (1, 0, number)


def home_cards(seasons: dict[str, str], index_by_window: dict[str, list]) -> dict[str, dict]:
    """Per group, in its default season: the top cars by Time Saved, or every car when none is ranked."""
    out = {}
    for group, season in seasons.items():
        entries = [e for e in index_by_window[season] if e["group"] == group]
        if not entries:
            continue
        leaders = sorted(
            (e for e in entries if _ranked_entry(group, e) and e["travel_vs_typical_sec"] is not None),
            key=lambda e: (e["travel_vs_typical_sec"], _natural(e["number"])),
        )[:HOME_LEADERS]
        out[group] = {
            "season": season,
            "leaders": leaders,
            "cars": [] if leaders else sorted((e["number"] for e in entries), key=_natural),
        }
    return out


def publish(root: Path, out: Path) -> None:
    root, out = Path(root), Path(out)
    data = out / "data"
    if data.exists():
        shutil.rmtree(data)  # no stale files from an earlier build; real errors raise
    now = datetime.now(timezone.utc).isoformat()
    wins = stats.windows(root)
    fleets: dict[str, dict] = {g: {} for g in GROUPS}
    index_by_window: dict[str, list] = {w.key: [] for w in wins}
    seen = {group: stats.last_seen(root, group) for group in GROUPS}
    for w in wins:
        for group in GROUPS:
            cars = stats.car_stats(root, group, w)
            if not cars:
                continue
            for c in cars:
                c["last_seen"] = seen[group].get(c["number"])
                if group == "bus":
                    c["crowd_load_pct"] = None
                v = roster.lookup(group, c["number"])
                c["vehicle"] = (
                    {k: getattr(v, k) for k in v.__dataclass_fields__} if v else {"fleet_label": "Unknown fleet"}
                )
                c["vehicle"].setdefault("fleet_key", "unknown")
            cars = add_percentiles(group, cars)
            segs_per_trip = cars[0].get("segs_per_trip")
            for c in cars:
                c.pop("segs_per_trip", None)
            typical = add_vs_typical(cars)
            summary = {"group": group, "window": w.key, "generated_at": now,
                       "qualify_min_trips": stats.qualify_threshold([c["trips"] for c in cars]),
                       "ranked_cars": sum(1 for c in cars if c["qualified"] and c["ranked"]),
                       "segs_per_trip": segs_per_trip, "typical": typical, "too_close": too_close(cars)}
            _write(
                data / w.key / "groups" / f"{group}.json",
                {**{k: v for k, v in summary.items() if k != "ranked_cars"},
                 "cars": [{k: v for k, v in c.items() if k not in ("game_log", "by_route")} for c in cars]},
            )
            # A few hundred bytes, for pages that need the line's typical car but not every car (the car page).
            _write(data / w.key / "groups" / f"{group}.summary.json", summary)
            if group == "bus":
                _write_routes(data / w.key / "routes", route_boards(cars, w.key, now))
            for c in cars:
                c.pop("by_route", None)
                _write(data / w.key / "cars" / group / f"{c['number']}.json", c)
                index_by_window[w.key].append(
                    {"car_id": c["car_id"], "group": group, "number": c["number"],
                     "fleet_label": c["vehicle"]["fleet_label"], "qualified": c["qualified"], "ranked": c["ranked"],
                     "travel_vs_typical_sec": c["travel_vs_typical_sec"], "pct_travel": c["pct"]["travel_time_sec"]}
                )
            fleets[group][w.key] = _fleet(cars)
        _write(data / w.key / "index.json", index_by_window[w.key])
    for group, by_window in fleets.items():
        if by_window:
            _write(data / "fleets" / f"{group}.json", by_window)
    seasons = default_seasons(wins, index_by_window)
    # The home page's cards, so it needn't load every car in every window.
    _write(data / "home.json", home_cards(seasons, index_by_window))
    _write(
        data / "meta.json",
        {"generated_at": now,
         "windows": [{"key": w.key, "start": w.start, "end": w.end} for w in wins],
         "latest_service_date": wins[0].end if wins else None,
         "default_season": seasons},
    )
