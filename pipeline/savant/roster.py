"""Vehicle roster: car/bus number -> builder, model, propulsion, fleet, garage."""

import json
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
