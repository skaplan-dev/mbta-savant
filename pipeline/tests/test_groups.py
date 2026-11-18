import pytest

from savant.groups import GROUPS, distance_miles, group_for_route, station_for_stop, stop_ids


def test_groups_tuple():
    assert GROUPS == ("red", "orange", "blue", "green", "mattapan", "bus")


@pytest.mark.parametrize(
    "route,group",
    [
        ("Red", "red"), ("Orange", "orange"), ("Blue", "blue"),
        ("Green-B", "green"), ("Green-C", "green"), ("Green-D", "green"), ("Green-E", "green"),
        ("Mattapan", "mattapan"),
        ("28", "bus"), ("742", "bus"), ("741", "bus"), ("749", "bus"), ("SL1", "bus"),
        ("CT2", "bus"), ("171", "bus"),
        ("CR-Lowell", None), ("Boat-F1", None), ("nonsense", None),
    ],
)
def test_group_for_route(route, group):
    assert group_for_route(route) == group


def test_stop_ids():
    assert "70061" in stop_ids("red")
    assert "28-1-1728" in stop_ids("bus")
    assert "70261" in stop_ids("mattapan")
    assert "70511" in stop_ids("green")
    ids = stop_ids("bus")
    assert len(ids) == len(set(ids))
    with pytest.raises(KeyError):
        stop_ids("nope")


def test_station_for_stop():
    assert station_for_stop("70061") == "place-alfcl"
    assert station_for_stop("28-1-1728") is None


def test_distance_symmetric():
    a = distance_miles("place-wondl", "place-rbmnl")
    assert a == pytest.approx(0.386, abs=0.001)
    assert distance_miles("place-rbmnl", "place-wondl") == a
    assert distance_miles("place-wondl", "place-nowhere") is None


def test_terminal_track_ids_map_to_their_station():
    # LAMP's public subway files name terminal tracks "<station>-NN" instead of a platform id
    assert station_for_stop("Oak Grove-02") == station_for_stop("70036") == "place-ogmnl"
    assert station_for_stop("Alewife-01") == station_for_stop("70061")
    assert station_for_stop("Nowhere-01") is None
