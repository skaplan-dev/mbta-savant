"""Reference data: ranking groups, stop -> station, station distances."""

import json
from functools import cache
from importlib.resources import files

GROUPS: tuple[str, ...] = ("red", "orange", "blue", "green", "mattapan", "bus")

_RAIL_KEYS = {"red": "Red", "orange": "Orange", "blue": "Blue", "green": "Green", "mattapan": "Mattapan"}
_GREEN_ROUTES = {"Green-B", "Green-C", "Green-D", "Green-E"}
# Silver Line route ids as used in GTFS; bus_constants keys them as SL1/SL2/...
_SILVER_LINE = {"741", "742", "743", "746", "749", "751"}

_DATA = files("savant") / "data"


def _load(name: str):
    return json.loads((_DATA / name).read_text())


@cache
def _stations() -> dict:
    return _load("stations.json")


@cache
def _distances() -> dict:
    return _load("station_distances.json")


@cache
def _bus_files() -> tuple[dict, ...]:
    return tuple(
        json.loads(p.read_text())
        for p in sorted((_DATA / "bus_constants").iterdir())
        if p.name.endswith(".json")
    )


@cache
def _bus_routes() -> frozenset[str]:
    routes = set(_SILVER_LINE)
    for d in _bus_files():
        for key in d:
            # combined routes are keyed like "104/109"
            routes.update(key.split("/"))
    return frozenset(routes)


def group_for_route(route_id: str) -> str | None:
    for group, key in _RAIL_KEYS.items():
        if route_id == key:
            return group
    if route_id in _GREEN_ROUTES:
        return "green"
    if route_id in _bus_routes():
        return "bus"
    return None


def _collect(stations: list[dict]) -> list[str]:
    seen: dict[str, None] = {}
    for st in stations:
        for ids in st["stops"].values():
            for sid in ids:
                seen[sid] = None
    return list(seen)


@cache
def _stop_ids(group: str) -> tuple[str, ...]:
    if group == "bus":
        out: dict[str, None] = {}
        for d in _bus_files():
            for route in d.values():
                out.update(dict.fromkeys(_collect(route["stations"])))
        return tuple(out)
    return tuple(_collect(_stations()[_RAIL_KEYS[group]]["stations"]))


def stop_ids(group: str) -> list[str]:
    if group not in GROUPS:
        raise KeyError(group)
    return list(_stop_ids(group))


@cache
def _stop_to_station() -> dict[str, str]:
    out: dict[str, str] = {}
    for line in _stations().values():
        for st in line["stations"]:
            for ids in st["stops"].values():
                for sid in ids:
                    out.setdefault(sid, st["station"])
    return out


@cache
def _name_to_station() -> dict[str, str]:
    return {st["stop_name"]: st["station"] for line in _stations().values() for st in line["stations"]}


def station_for_stop(stop_id: str) -> str | None:
    """Platform id -> station; a terminal track id like ``Oak Grove-02`` (public LAMP files) by station name."""
    found = _stop_to_station().get(stop_id)
    if found is None:
        name, sep, track = stop_id.rpartition("-")
        if sep and track.isdigit():
            found = _name_to_station().get(name)
    return found


def distance_miles(from_station: str, to_station: str) -> float | None:
    d = _distances()
    if to_station in d.get(from_station, {}):
        return d[from_station][to_station]
    return d.get(to_station, {}).get(from_station)
