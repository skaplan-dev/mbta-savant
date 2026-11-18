"""Build a self-contained car-page mockup from real out/data JSON.

Usage: python3 -I build_car.py <repo_out_data_dir> <group> <number> <out_html>
"""

import json
import statistics
import sys
from pathlib import Path

data_dir, group, number, out_html = Path(sys.argv[1]), sys.argv[2], sys.argv[3], Path(sys.argv[4])
here = Path(__file__).parent


def load(p):
    try:
        return json.loads(p.read_text())
    except FileNotFoundError:
        return None


def averages(window):
    g = load(data_dir / window / "groups" / f"{group}.json")
    if not g:
        return None, None
    ranked = [c for c in g["cars"] if c.get("qualified") and c.get("ranked")]
    def mean(k):
        vals = [c[k] for c in ranked if c.get(k) is not None]
        return statistics.fmean(vals) if vals else None
    return {"ttoe_sec": mean("ttoe_sec"), "speed_vs_expected_pct": mean("speed_vs_expected_pct"), "ranked": len(ranked), "cars": len(g["cars"])}, g


seasons = {}
for window in ("2026", "2025", "last30"):
    car = load(data_dir / window / "cars" / group / f"{number}.json")
    avg, _ = averages(window)
    if car:
        seasons[window] = {"car": car, "avg": avg}

meta = load(data_dir / "meta.json")
fleets = load(data_dir / "fleets" / f"{group}.json")
payload = {"group": group, "number": number, "seasons": seasons, "meta": meta, "fleets": fleets}
html = (here / "car_template.html").read_text().replace("__DATA__", json.dumps(payload))
out_html.write_text(html)
print(out_html, len(html))
