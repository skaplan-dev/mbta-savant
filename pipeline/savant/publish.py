"""Percentile ranking and static JSON publishing.

Percentile = 100 * (qualified cars in the group this car strictly beats) / (n - 1), rounded to an int,
where n is the number of qualified cars with a value for the metric. Ties never count as beating, so
tied cars share a percentile. n == 1 gives 100. Unqualified cars, cars missing the metric, unranked
metrics, and the mattapan group get None.

TTOE, Speed vs Expected and Door Time are also shown against the group's average car
(``ttoe_vs_avg_sec``, ``speed_vs_avg_pct``, ``door_vs_avg_sec``): the absolute values sit on one side of
zero because delay and dwell distributions are skewed late. The average is the mean over qualified, ranked cars. These are display-only; percentiles
stay on the absolute fields (centering does not change rank).
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
    "ttoe_sec": "lower",
    "speed_vs_expected_pct": "higher",
    "on_time_pct": "higher",
    "steadiness_sec": "lower",
    "door_time_sec": "lower",
    "games_played_pct": "higher",
    "iron_horse_days": "higher",
    "miles": "higher",
    "routes": "higher",
    "crowd_load_pct": None,
}
UNRANKED_GROUPS = {"mattapan"}
# centered field -> absolute field it is centered from
VS_AVG = {
    "ttoe_vs_avg_sec": "ttoe_sec",
    "speed_vs_avg_pct": "speed_vs_expected_pct",
    "door_vs_avg_sec": "door_time_sec",
}


def add_percentiles(group: str, cars: list[dict]) -> list[dict]:
    out = [
        {**c, "pct": {m: None for m in METRICS},
         "ranked": group not in UNRANKED_GROUPS and roster.lookup(group, c["number"]) is not None}
        for c in cars
    ]
    if group in UNRANKED_GROUPS:
        return out
    for metric, direction in METRICS.items():
        if direction is None:
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


def add_vs_avg(cars: list[dict]) -> dict[str, float | None]:
    """Set each car's VS_AVG fields in place; return the averages keyed by absolute field."""
    averages: dict[str, float | None] = {}
    for centered, metric in VS_AVG.items():
        vals = [c[metric] for c in cars if c.get("qualified") and c["ranked"] and c.get(metric) is not None]
        avg = statistics.fmean(vals) if vals else None
        averages[metric] = avg
        for c in cars:
            v = c.get(metric)
            c[centered] = None if avg is None or v is None else v - avg
    return averages


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
        for m in (*METRICS, *VS_AVG):
            if c.get(m) is not None:
                f["median"].setdefault(m, []).append(c[m])
    for f in fleets.values():
        f["median"] = {m: statistics.median(vals) for m, vals in f["median"].items()}
    return fleets


def route_boards(cars: list[dict], window: str, now: str) -> dict[str, dict]:
    """Bus cars (with ``by_route``) -> route -> that route's board, ranked and averaged within the route.

    A route board is shaped like a group file plus ``route``, and each of its cars keeps the bus's identity
    (car_id, number, vehicle) with the per-route metrics, so the web renders it with the line leaderboard.
    """
    by_route: dict[str, list[dict]] = {}
    for c in cars:
        for r in c.get("by_route", []):
            by_route.setdefault(r["route"], []).append(
                {"car_id": c["car_id"], "number": c["number"], **{k: v for k, v in r.items() if k != "route"},
                 "routes": None, "crowd_load_pct": None, "teammates": [], "vehicle": c["vehicle"]}
            )
    boards = {}
    for route, rcars in by_route.items():
        rcars = add_percentiles("bus", rcars)
        boards[route] = {"group": "bus", "route": route, "window": window, "generated_at": now,
                         "qualify_min_trips": stats.ROUTE_QUALIFY_MIN_TRIPS, "averages": add_vs_avg(rcars),
                         "cars": rcars}
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
            (e for e in entries if _ranked_entry(group, e) and e["ttoe_vs_avg_sec"] is not None),
            key=lambda e: (e["ttoe_vs_avg_sec"], _natural(e["number"])),
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
    for w in wins:
        for group in GROUPS:
            cars = stats.car_stats(root, group, w)
            if not cars:
                continue
            for c in cars:
                if group == "bus":
                    c["crowd_load_pct"] = None
                v = roster.lookup(group, c["number"])
                c["vehicle"] = (
                    {k: getattr(v, k) for k in v.__dataclass_fields__} if v else {"fleet_label": "Unknown fleet"}
                )
                c["vehicle"].setdefault("fleet_key", "unknown")
            cars = add_percentiles(group, cars)
            averages = add_vs_avg(cars)
            summary = {"group": group, "window": w.key, "generated_at": now,
                       "qualify_min_trips": stats.qualify_threshold([c["trips"] for c in cars]),
                       "ranked_cars": sum(1 for c in cars if c["qualified"] and c["ranked"]),
                       "averages": averages}
            _write(
                data / w.key / "groups" / f"{group}.json",
                {**{k: v for k, v in summary.items() if k != "ranked_cars"},
                 "cars": [{k: v for k, v in c.items() if k not in ("game_log", "by_route")} for c in cars]},
            )
            # A few hundred bytes, for pages that need the line average but not every car (the car page).
            _write(data / w.key / "groups" / f"{group}.summary.json", summary)
            if group == "bus":
                _write_routes(data / w.key / "routes", route_boards(cars, w.key, now))
            for c in cars:
                c.pop("by_route", None)
                _write(data / w.key / "cars" / group / f"{c['number']}.json", c)
                index_by_window[w.key].append(
                    {"car_id": c["car_id"], "group": group, "number": c["number"],
                     "fleet_label": c["vehicle"]["fleet_label"], "qualified": c["qualified"], "ranked": c["ranked"],
                     "ttoe_sec": c["ttoe_sec"], "ttoe_vs_avg_sec": c["ttoe_vs_avg_sec"], "pct_ttoe": c["pct"]["ttoe_sec"]}
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
