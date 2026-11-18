from datetime import date

import pytest
from botocore.exceptions import ClientError, ResponseStreamingError
from urllib3.exceptions import ProtocolError

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


class FlakyBody:
    def __init__(self, owner, data):
        self.owner, self.data = owner, data

    def read(self):
        if self.owner.failures > 0:
            self.owner.failures -= 1
            raise self.owner.exc
        return self.data


class FlakyClient:
    def __init__(self, failures, data, exc=None):
        self.failures, self.data = failures, data
        self.exc = exc or ProtocolError("connection broken")
        self.calls = 0

    def get_object(self, Bucket, Key):
        self.calls += 1
        return {"Body": FlakyBody(self, self.data)}


@pytest.fixture
def sleeps(monkeypatch):
    calls = []
    monkeypatch.setattr(events, "_sleep", calls.append)
    return calls


def test_body_read_retries_then_succeeds(monkeypatch, sleeps):
    monkeypatch.setattr(events, "stop_ids", lambda g: ["70061"])
    client = FlakyClient(2, _csv("ARR", "DEP"))
    rows = events.day_events("red", date(2024, 5, 1), client=client)
    assert [r["event_type"] for r in rows] == ["ARR", "DEP"]
    assert client.calls == 3  # get_object re-issued per attempt
    assert sleeps == [1, 2]


def test_body_read_gives_up_after_retries(monkeypatch, sleeps):
    monkeypatch.setattr(events, "stop_ids", lambda g: ["70061"])
    client = FlakyClient(4, _csv("ARR"))
    with pytest.raises(ProtocolError):
        events.day_events("red", date(2024, 5, 1), client=client)
    assert client.calls == 4
    assert sleeps == [1, 2, 4]


@pytest.mark.parametrize("exc", [ResponseStreamingError(error="x"), ConnectionError("reset")])
def test_other_retryable_errors(monkeypatch, sleeps, exc):
    monkeypatch.setattr(events, "stop_ids", lambda g: ["70061"])
    client = FlakyClient(1, _csv("ARR"), exc=exc)
    assert len(events.day_events("red", date(2024, 5, 1), client=client)) == 1


def test_client_uses_adaptive_retries(monkeypatch):
    import boto3

    seen = {}
    monkeypatch.setattr(boto3, "client", lambda name, config=None: seen.update(config=config))
    events._client(None)
    assert seen["config"].retries == {"max_attempts": 8, "mode": "adaptive"}


def test_other_errors_propagate(monkeypatch):
    monkeypatch.setattr(events, "stop_ids", lambda g: ["70061"])
    with pytest.raises(ClientError):
        events.day_events("red", date(2024, 5, 1), client=FakeClient(error="InternalError"))


class CountingErrClient:
    def __init__(self, code):
        self.code, self.calls = code, 0

    def get_object(self, Bucket, Key):
        self.calls += 1
        raise _err(self.code)


@pytest.mark.parametrize("code", ["NoSuchKey", "AccessDenied", "403"])
def test_missing_key_skipped_without_retry(code, sleeps):
    # without s3:ListBucket, S3 answers 403/AccessDenied for a missing key
    client = CountingErrClient(code)
    assert events.download(client, "k") is None
    assert client.calls == 1 and sleeps == []


def test_other_client_errors_still_raise(sleeps):
    client = CountingErrClient("InternalError")
    with pytest.raises(ClientError):
        events.download(client, "k")
    assert client.calls == 1 and sleeps == []
