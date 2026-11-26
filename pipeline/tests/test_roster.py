import json
from importlib.resources import files

import pytest

from savant.groups import GROUPS
from savant.roster import Vehicle, lookup


def test_bus_1600_is_xn40_cng_at_arborway():
    v = lookup("bus", "1600")
    assert isinstance(v, Vehicle)
    assert v.model == "XN40"
    assert v.propulsion == "cng"
    assert v.garage == "Arborway"


def test_lookup_is_group_scoped():
    assert lookup("orange", "1400").builder == "CRRC"
    assert lookup("bus", "1400").model == "XDE40"


def test_blue_leading_zero_matches():
    assert lookup("blue", "0700").builder == "Siemens"
    assert lookup("blue", "700").builder == "Siemens"


def test_unknown_car_returns_none():
    assert lookup("red", "9999") is None
    assert lookup("nope", "1") is None
    assert lookup("bus", "abc") is None


def test_garage_edge_cases():
    assert lookup("bus", "3000").garage == "Paul Revere (contractor)"
    assert lookup("bus", "0840").garage == "Albany St."
    assert lookup("bus", "2088").garage == "Lynn"
    assert lookup("bus", "2089").garage == "Charlestown"
    assert lookup("bus", "0800").garage is None
    assert lookup("blue", "0700").garage is None


def test_mattapan_and_green():
    assert lookup("mattapan", "3234").builder == "Pullman-Standard"
    assert lookup("mattapan", "3234").propulsion == "electric"
    assert lookup("green", "3900").model == "Type 9"


def _series():
    return json.loads((files("savant") / "data" / "roster.json").read_text())["series"]


def test_series_groups_valid_and_no_overlap():
    by_group: dict[str, list[tuple[int, int]]] = {}
    for s in _series():
        assert s["group"] in GROUPS
        lo, hi = int(s["from"]), int(s["to"])
        assert lo <= hi
        by_group.setdefault(s["group"], []).append((lo, hi))
    assert set(by_group) == set(GROUPS)
    for group, ranges in by_group.items():
        ranges.sort()
        for (_, prev_hi), (next_lo, _) in zip(ranges, ranges[1:]):
            assert prev_hi < next_lo, f"overlap in {group}"


def test_garages_in_bus_series_and_no_overlap():
    garages = json.loads((files("savant") / "data" / "roster.json").read_text())["garages"]
    spans = sorted((int(g["from"]), int(g["to"])) for g in garages)
    for (_, a), (b, _) in zip(spans, spans[1:]):
        assert a < b
    assert {g["name"] for g in garages} == {
        "Albany St.", "Arborway", "Cabot", "Charlestown", "Fellsway", "Lynn",
        "Quincy", "Southampton St.", "Paul Revere (contractor)",
    }


@pytest.mark.parametrize("group", GROUPS)
def test_required_fields(group):
    keys = {"group", "from", "to", "fleet_key", "fleet_label", "builder", "model", "propulsion", "years", "length_ft"}
    rows = [s for s in _series() if s["group"] == group]
    assert rows
    for s in rows:
        assert keys <= set(s)


def test_red_crrc_covers_full_order():
    assert lookup("red", "2100").builder == "CRRC"
    assert lookup("red", "2151").builder == "CRRC"
    assert lookup("red", "2152") is None


def test_green_type10_on_order_series():
    v = lookup("green", "4050")
    assert v.builder == "CAF"
    assert v.fleet_key == "green-type10"


def test_last_build_year():
    from savant.roster import last_build_year
    assert last_build_year("2024–26") == 2026
    assert last_build_year("1999-2007") == 2007
    assert last_build_year("1997") == 1997
    assert last_build_year("2019-") == last_build_year("2019–") == 9999
    assert last_build_year("1999–07") == 2007
    assert last_build_year("") is None
    assert last_build_year("n/a") is None


def test_orange_hawker_retired():
    for n in ("1200", "01319", "1250"):
        v = lookup("orange", n)
        assert v is not None
        assert v.fleet_key == "orange-hawker"
        assert v.retired == "2022"
    assert lookup("orange", "1320") is None


def test_in_service_not_retired():
    assert lookup("orange", "1400").retired is None
