"""Command line entry point: ingest, backfill and build."""

import argparse
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from pathlib import Path

from savant import lamp
from savant.groups import GROUPS
from savant.pages import write_pages
from savant.publish import publish
from savant.segments import day_path, write_day


def _groups(arg: str | None) -> list[str]:
    if not arg:
        return list(GROUPS)
    groups = [g.strip() for g in arg.split(",") if g.strip()]
    bad = [g for g in groups if g not in GROUPS]
    if bad:
        raise SystemExit(f"unknown group(s): {', '.join(bad)}")
    return groups


def _ingest(day: date, groups: list[str], root: Path) -> None:
    for group, segments in lamp.day_segments(day, groups).items():
        write_day(segments, root, group, day)
        print(f"{group} {day.isoformat()}: {len(segments)} segments")


def cmd_ingest(args) -> int:
    day = date.fromisoformat(args.date)
    _ingest(day, _groups(args.groups), Path(args.root))
    return 0


def cmd_backfill(args) -> int:
    start, end = date.fromisoformat(args.start), date.fromisoformat(args.end)
    if end < start:
        print("error: --end is before --start", file=sys.stderr)
        raise SystemExit(2)
    root = Path(args.root)
    groups = _groups(args.groups)
    days = [start + timedelta(n) for n in range((end - start).days + 1)]

    def one_day(d: date) -> str | None:
        try:
            todo = [g for g in groups if args.force or not day_path(root, g, d).exists()]
            for g in groups:
                if g not in todo:
                    print(f"{g} {d.isoformat()}: skipped (exists)")
            if todo:
                _ingest(d, todo, root)
        except Exception as ex:  # keep going; reported at the end
            print(f"error: {d.isoformat()} failed: {ex!r}", file=sys.stderr)
            return d.isoformat()
        return None

    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        failed = [f for f in pool.map(one_day, days) if f]
    if failed:
        print(f"backfill failed for {len(failed)} day(s): {', '.join(failed)}", file=sys.stderr)
        return 1
    return 0


def cmd_build(args) -> int:
    publish(Path(args.root), Path(args.out), Path(args.frozen) if args.frozen else None)
    return 0


def cmd_pages(args) -> int:
    n = write_pages(Path(args.template), Path(args.data), Path(args.out), args.host)
    print(f"wrote {n} pages to {args.out}")
    return 0


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="savant")
    sub = p.add_subparsers(dest="cmd", required=True)

    i = sub.add_parser("ingest", help="ingest one service day")
    i.add_argument("--date", required=True)
    i.add_argument("--groups")
    i.add_argument("--root", default="./work")
    i.set_defaults(func=cmd_ingest)

    b = sub.add_parser("backfill", help="ingest a date range from the MBTA's public LAMP files")
    b.add_argument("--start", required=True)
    b.add_argument("--end", required=True)
    b.add_argument("--workers", type=int, default=5)
    b.add_argument("--groups")
    b.add_argument("--root", default="./work")
    b.add_argument("--force", action="store_true")
    b.set_defaults(func=cmd_backfill)

    u = sub.add_parser("build", help="publish JSON for the site")
    u.add_argument("--root", default="./work")
    u.add_argument("--out", default="./out")
    u.add_argument("--frozen", help="a copy of a published data/ folder: its closed years are copied, not recomputed")
    u.set_defaults(func=cmd_build)

    g = sub.add_parser("pages", help="per-page HTML shells, sitemap.xml and robots.txt for crawlers")
    g.add_argument("--template", required=True, help="the deployed index.html")
    g.add_argument("--data", required=True, help="a data/ folder (meta.json, <window>/index.json, ...)")
    g.add_argument("--out", required=True)
    g.add_argument("--host", required=True, help="canonical hostname, e.g. mbtasavant.com")
    g.set_defaults(func=cmd_pages)

    args = p.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
