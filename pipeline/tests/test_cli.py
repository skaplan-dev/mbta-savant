import json
import re
from pathlib import Path

import pytest
from botocore.exceptions import ClientError

from savant import cli, groups

FIXTURE = Path(__file__).parent / "fixtures" / "orange_day.csv"
KEY = re.compile(r"/(?P<stop>[^/]+)/Year=(?P<y>\d+)/Month=(?P<m>\d+)(?:/Day=(?P<d>\d+))?/events")


def _day_text(day: str) -> str:
    return FIXTURE.read_text().replace("2024-05-01", day)


def _filter(text: str, stop: str) -> str:
    lines = text.splitlines()
    keep = [lines[0]] + [l for l in lines[1:] if l.split(",")[4] == stop]
    return "\n".join(keep) + "\n"


class FakeBody:
    def __init__(self, data):
        self.data = data

    def read(self):
        return self.data


class FakeClient:
    """Serves fixture rows for 2026-05-01..03 from LAMP daily keys; records every key."""

    days = {1: "2026-05-01", 2: "2026-05-02", 3: "2026-05-03"}
    fail_day = None

    def __init__(self):
        self.keys = []

    def get_object(self, Bucket, Key):
        self.keys.append(Key)
        m = KEY.search(Key)
        stop = m["stop"]
        if m["d"] is None or (m["y"], m["m"]) != ("2026", "5") or int(m["d"]) not in self.days:
            raise ClientError({"Error": {"Code": "NoSuchKey", "Message": ""}}, "GetObject")
        if int(m["d"]) == self.fail_day:
            raise ClientError({"Error": {"Code": "AccessDenied", "Message": ""}}, "GetObject")
        return {"Body": FakeBody(_filter(_day_text(self.days[int(m["d"])]), stop).encode())}


@pytest.fixture
def fake(monkeypatch):
    monkeypatch.setattr(cli, "_make_client", lambda: FakeClient())


def _orange(root):
    return sorted((root / "segments" / "orange").rglob("*.parquet"))


def test_ingest_then_build(fake, tmp_path, capsys):
    root, out = tmp_path / "work", tmp_path / "out"
    for d in ("2026-05-01", "2026-05-02"):
        assert cli.main(["ingest", "--date", d, "--groups", "orange", "--root", str(root)]) == 0
    assert len(_orange(root)) == 2
    assert "orange 2026-05-01:" in capsys.readouterr().out
    assert cli.main(["build", "--root", str(root), "--out", str(out)]) == 0
    assert (out / "data" / "meta.json").exists()
    assert json.loads((out / "data/2026/groups/orange.json").read_text())
    assert list((out / "data/2026/cars/orange").glob("*.json"))


def test_ingest_empty_day(fake, tmp_path, capsys):
    assert cli.main(["ingest", "--date", "2026-05-09", "--groups", "orange", "--root", str(tmp_path)]) == 0
    assert _orange(tmp_path) == []
    assert "orange 2026-05-09: 0 segments" in capsys.readouterr().out


def test_ingest_default_groups(fake, tmp_path, capsys):
    assert cli.main(["ingest", "--date", "2026-05-01", "--root", str(tmp_path)]) == 0
    out = capsys.readouterr().out
    for g in groups.GROUPS:
        assert f"{g} 2026-05-01:" in out


def test_backfill_skips_existing_unless_force(fake, tmp_path, capsys):
    args = ["backfill", "--start", "2026-05-01", "--end", "2026-05-03", "--groups", "orange", "--root", str(tmp_path)]
    assert cli.main(args) == 0
    files = _orange(tmp_path)
    assert len(files) == 3
    capsys.readouterr()
    files[0].write_bytes(b"sentinel")
    assert cli.main(args) == 0
    assert files[0].read_bytes() == b"sentinel"
    assert "skipped" in capsys.readouterr().out
    assert cli.main(args + ["--force"]) == 0
    assert files[0].read_bytes() != b"sentinel"


def test_backfill_uses_lamp_daily_keys_only(monkeypatch, tmp_path, capsys):
    client = FakeClient()
    monkeypatch.setattr(cli, "_make_client", lambda: client)
    args = ["backfill", "--start", "2026-05-01", "--end", "2026-05-03", "--groups", "orange", "--workers", "2", "--root", str(tmp_path)]
    assert cli.main(args) == 0
    assert len(_orange(tmp_path)) == 3
    assert client.keys and all(k.startswith("Events-lamp/") for k in client.keys)
    assert not any("Events/monthly-" in k for k in client.keys)
    assert "orange 2026-05-02:" in capsys.readouterr().out


def test_backfill_end_before_start_exits_2(fake, tmp_path, capsys):
    with pytest.raises(SystemExit) as ex:
        cli.main(["backfill", "--start", "2026-05-03", "--end", "2026-05-01", "--root", str(tmp_path)])
    assert ex.value.code == 2


def test_backfill_failed_day_continues_and_exits_nonzero(monkeypatch, tmp_path, capsys):
    client = FakeClient()
    client.fail_day = 2
    monkeypatch.setattr(cli, "_make_client", lambda: client)
    args = ["backfill", "--start", "2026-05-01", "--end", "2026-05-03", "--groups", "orange", "--root", str(tmp_path)]
    assert cli.main(args) == 1
    assert len(_orange(tmp_path)) == 2
    captured = capsys.readouterr()
    assert "2026-05-02" in captured.err and "failed" in captured.err.lower()
