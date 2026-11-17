"""Command line entry point: ingest, backfill and build."""

import argparse
import sys
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

from savant import events
from savant.groups import GROUPS
from savant.publish import publish
from savant.segments import build_segments, day_path, write_day


def _make_client():
    """S3 client factory; None lets events create its own. Tests monkeypatch this."""
    return None


def _groups(arg: str | None) -> list[str]:
    if not arg:
        return list(GROUPS)
    groups = [g.strip() for g in arg.split(",") if g.strip()]
    bad = [g for g in groups if g not in GROUPS]
    if bad:
        raise SystemExit(f"unknown group(s): {', '.join(bad)}")
    return groups


def _write(rows: list[dict], root: Path, group: str, day: date) -> None:
    segments = build_segments(group, rows)
    write_day(segments, root, group, day)
    print(f"{group} {day.isoformat()}: {len(segments)} segments")


def cmd_ingest(args) -> int:
    day = date.fromisoformat(args.date)
    root = Path(args.root)
    client = _make_client()
    for group in _groups(args.groups):
        _write(events.day_events(group, day, client=client), root, group, day)
    return 0


def cmd_backfill(args) -> int:
    start, end = date.fromisoformat(args.start), date.fromisoformat(args.end)
    root = Path(args.root)
    client = _make_client()
    days = [start + timedelta(n) for n in range((end - start).days + 1)]
    months = sorted({(d.year, d.month) for d in days})
    for group in _groups(args.groups):
        todo = [d for d in days if args.force or not day_path(root, group, d).exists()]
        for d in days:
            if d not in todo:
                print(f"{group} {d.isoformat()}: skipped (exists)")
        for year, month in months:
            wanted = {d.isoformat(): d for d in todo if (d.year, d.month) == (year, month)}
            if not wanted:
                continue
            by_day = defaultdict(list)
            for row in events.month_events(group, year, month, client=client):
                if row["service_date"] in wanted:
                    by_day[row["service_date"]].append(row)
            for key, d in wanted.items():
                _write(by_day.get(key, []), root, group, d)
    return 0


def cmd_build(args) -> int:
    publish(Path(args.root), Path(args.out))
    return 0


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="savant")
    sub = p.add_subparsers(dest="cmd", required=True)

    i = sub.add_parser("ingest", help="ingest one service day")
    i.add_argument("--date", required=True)
    i.add_argument("--groups")
    i.add_argument("--root", default="./work")
    i.set_defaults(func=cmd_ingest)

    b = sub.add_parser("backfill", help="ingest a date range from monthly data")
    b.add_argument("--start", required=True)
    b.add_argument("--end", required=True)
    b.add_argument("--groups")
    b.add_argument("--root", default="./work")
    b.add_argument("--force", action="store_true")
    b.set_defaults(func=cmd_backfill)

    u = sub.add_parser("build", help="publish JSON for the site")
    u.add_argument("--root", default="./work")
    u.add_argument("--out", default="./out")
    u.set_defaults(func=cmd_build)

    args = p.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
