import json
from datetime import date
from pathlib import Path

import pytest
from lamp_data import bus_file, bus_stop, rail_file, rail_trip

from savant import cli, groups, lamp

DAYS = [date(2026, 5, 1), date(2026, 5, 2), date(2026, 5, 3)]
ORANGE = ["70036", "70034", "70032"]


class Lamp:
    """Serves rail files for DAYS (and a bus file) from a temp dir; `broken` days fail to parse."""

    def __init__(self, tmp_path, monkeypatch, broken=()):
        d = tmp_path / "lamp"
        d.mkdir()
        for day in DAYS:
            path = d / f"{day.isoformat()}.parquet"
            if day in broken:
                path.write_bytes(b"not parquet")
            else:
                rail_file(path, [r for trip in range(60) for r in rail_trip(day, f"t{trip}", ORANGE)])
        bus = [bus_stop(day, "b", seq, stop, (8, seq, 0), (8, seq, 10)) for day in DAYS for seq, stop in ((1, "1"), (2, "2"))]
        monkeypatch.setattr(lamp, "RAIL_URL", str(d / "{day}.parquet"))
        monkeypatch.setattr(lamp, "BUS_URL", str(bus_file(d / "bus.parquet", bus)))


@pytest.fixture
def fake(tmp_path, monkeypatch):
    return Lamp(tmp_path, monkeypatch)


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


def test_backfill_end_before_start_exits_2(fake, tmp_path, capsys):
    with pytest.raises(SystemExit) as ex:
        cli.main(["backfill", "--start", "2026-05-03", "--end", "2026-05-01", "--root", str(tmp_path)])
    assert ex.value.code == 2


def test_backfill_failed_day_continues_and_exits_nonzero(tmp_path, monkeypatch, capsys):
    Lamp(tmp_path, monkeypatch, broken=[DAYS[1]])
    args = ["backfill", "--start", "2026-05-01", "--end", "2026-05-03", "--groups", "orange", "--root", str(tmp_path / "w")]
    assert cli.main(args) == 1
    assert len(_orange(tmp_path / "w")) == 2
    captured = capsys.readouterr()
    assert "2026-05-02" in captured.err and "failed" in captured.err.lower()


def test_missing_day_writes_nothing(fake, tmp_path, capsys):
    assert cli.main(["ingest", "--date", "2026-05-09", "--groups", "orange,bus", "--root", str(tmp_path / "w")]) == 0
    out = capsys.readouterr().out
    assert "orange 2026-05-09: 0 segments" in out and "bus 2026-05-09: 0 segments" in out


def test_bus_ingest(fake, tmp_path):
    assert cli.main(["ingest", "--date", "2026-05-01", "--groups", "bus", "--root", str(tmp_path / "w")]) == 0
    assert list((tmp_path / "w" / "segments" / "bus").rglob("*.parquet"))


def test_build_passes_frozen(tmp_path, monkeypatch):
    calls = []
    monkeypatch.setattr(cli, "publish", lambda root, out, frozen=None: calls.append((root, out, frozen)))
    assert cli.main(["build", "--root", "r", "--out", "o", "--frozen", str(tmp_path)]) == 0
    assert calls == [(Path("r"), Path("o"), tmp_path)]
    assert cli.main(["build", "--root", "r", "--out", "o"]) == 0
    assert calls[-1] == (Path("r"), Path("o"), None)
