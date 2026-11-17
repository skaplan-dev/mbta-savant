import gzip
from datetime import date

import pytest
from botocore.exceptions import ClientError

from savant import events

HEADER = "service_date,stop_id,event_type,event_time\n"


def _err(code):
    return ClientError({"Error": {"Code": code, "Message": code}}, "GetObject")


class FakeBody:
    def __init__(self, data):
        self._data = data

    def read(self):
        return self._data


class FakeClient:
    def __init__(self, objects=None, error=None):
        self.objects = objects or {}
        self.error = error
        self.keys = []

    def get_object(self, Bucket, Key):
        assert Bucket == "tm-mbta-performance"
        self.keys.append(Key)
        if self.error:
            raise _err(self.error)
        if Key not in self.objects:
            raise _err("NoSuchKey")
        return {"Body": FakeBody(self.objects[Key])}


def _csv(*types):
    return (HEADER + "".join(f"2024-05-01,x,{t},2024-05-01T10:00:00-04:00\n" for t in types)).encode()


def test_missing_day_returns_empty():
    assert events.day_events("red", date(2024, 5, 1), client=FakeClient()) == []


def test_drops_predicted_events(monkeypatch):
    monkeypatch.setattr(events, "stop_ids", lambda g: ["70061"])
    key = "Events-lamp/daily-data/70061/Year=2024/Month=5/Day=1/events.csv"
    client = FakeClient({key: _csv("ARR", "DEP", "PRA", "PRD")})
    rows = events.day_events("red", date(2024, 5, 1), client=client)
    assert [r["event_type"] for r in rows] == ["ARR", "DEP"]


def test_bus_stop_uses_bus_folder(monkeypatch):
    monkeypatch.setattr(events, "stop_ids", lambda g: ["28-1-1728", "70061"])
    client = FakeClient()
    events.day_events("bus", date(2024, 5, 1), client=client)
    assert sorted(client.keys) == [
        "Events-lamp/bus-daily-data/28-1-1728/Year=2024/Month=5/Day=1/events.csv",
        "Events-lamp/daily-data/70061/Year=2024/Month=5/Day=1/events.csv",
    ]


def test_month_events_gzip(monkeypatch):
    monkeypatch.setattr(events, "stop_ids", lambda g: ["70061"])
    key = "Events/monthly-data/70061/Year=2024/Month=5/events.csv.gz"
    client = FakeClient({key: gzip.compress(_csv("ARR", "PRA"))})
    rows = events.month_events("red", 2024, 5, client=client)
    assert [r["event_type"] for r in rows] == ["ARR"]


def test_other_errors_propagate(monkeypatch):
    monkeypatch.setattr(events, "stop_ids", lambda g: ["70061"])
    with pytest.raises(ClientError):
        events.day_events("red", date(2024, 5, 1), client=FakeClient(error="AccessDenied"))
    with pytest.raises(ClientError):
        events.month_events("red", 2024, 5, client=FakeClient(error="AccessDenied"))
