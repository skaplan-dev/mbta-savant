"""Percentile ranking and static JSON publishing.

Percentile = 100 * (qualified cars in the group this car strictly beats) / (n - 1), rounded to an int,
where n is the number of qualified cars with a value for the metric. Ties never count as beating, so
tied cars share a percentile. n == 1 gives 100. Unqualified cars, cars missing the metric, unranked
metrics, and the mattapan group get None.
"""

import json
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
        for m in METRICS:
            if c.get(m) is not None:
                f["median"].setdefault(m, []).append(c[m])
    for f in fleets.values():
        f["median"] = {m: statistics.median(vals) for m, vals in f["median"].items()}
    return fleets


def publish(root: Path, out: Path) -> None:
    root, out = Path(root), Path(out)
    data = out / "data"
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
            _write(
                data / w.key / "groups" / f"{group}.json",
                {"group": group, "window": w.key, "generated_at": now,
                 "cars": [{k: v for k, v in c.items() if k != "game_log"} for c in cars]},
            )
            for c in cars:
                _write(data / w.key / "cars" / group / f"{c['number']}.json", c)
                index_by_window[w.key].append(
                    {"car_id": c["car_id"], "group": group, "number": c["number"],
                     "fleet_label": c["vehicle"]["fleet_label"], "qualified": c["qualified"], "ranked": c["ranked"],
                     "ttoe_sec": c["ttoe_sec"], "pct_ttoe": c["pct"]["ttoe_sec"]}
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
