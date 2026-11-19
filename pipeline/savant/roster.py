"""Vehicle roster: car/bus number -> builder, model, propulsion, fleet, garage."""

import json
import re
from dataclasses import dataclass
from functools import cache
from importlib.resources import files


@dataclass(frozen=True)
class Vehicle:
    group: str
    number: str
    fleet_key: str
    fleet_label: str
    builder: str
    model: str
    propulsion: str
    years: str
    length_ft: float
    garage: str | None


@cache
def _roster() -> dict:
    return json.loads((files("savant") / "data" / "roster.json").read_text())


def lookup(group: str, number: str) -> Vehicle | None:
    try:
        n = int(number)
    except (TypeError, ValueError):
        return None
    roster = _roster()
    for s in roster["series"]:
        if s["group"] == group and int(s["from"]) <= n <= int(s["to"]):
            garage = None
            if group == "bus":
                garage = next(
                    (g["name"] for g in roster["garages"] if int(g["from"]) <= n <= int(g["to"])), None
                )
            return Vehicle(
                group=group, number=str(number), fleet_key=s["fleet_key"], fleet_label=s["fleet_label"],
                builder=s["builder"], model=s["model"], propulsion=s["propulsion"], years=s["years"],
                length_ft=s["length_ft"], garage=garage,
            )
    return None


def last_build_year(years: str) -> int | None:
    """Last build year from a roster ``years`` string ("2024–26", "1999-2007", "2019-", "1997"); an open-ended
    range counts as still delivering (returns 9999). None if unparseable."""
    m = re.fullmatch(r"\s*(\d{4})\s*(?:([-–—])\s*(\d{2,4})?)?\s*", years or "")
    if not m:
        return None
    start, dash, end = int(m.group(1)), m.group(2), m.group(3)
    if not dash:
        return start
    if end is None:
        return 9999
    e = int(end)
    if len(end) == 4:
        return e
    full = start // 100 * 100 + e
    return full if full >= start else full + 100
