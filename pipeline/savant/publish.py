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
    "top_speed_mph": None,
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
                 "cars": [{k: v for k, v in c.items() if k != "game_log"} for c in cars]},
            )
            # A few hundred bytes, for pages that need the line average but not every car (the car page).
            _write(data / w.key / "groups" / f"{group}.summary.json", summary)
            for c in cars:
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
    _write(
        data / "meta.json",
        {"generated_at": now,
         "windows": [{"key": w.key, "start": w.start, "end": w.end} for w in wins],
         "latest_service_date": wins[0].end if wins else None},
    )
