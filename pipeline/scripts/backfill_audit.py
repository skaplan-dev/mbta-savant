"""One-off audit for backfilled segments: null rates, unknown cars, stop coverage.

Run: uv run python scripts/backfill_audit.py --root ../work --start 2019 --end 2024
"""
from __future__ import annotations

import argparse
from pathlib import Path

import duckdb

from savant import roster


def glob_for(root: Path, group: str, year: int) -> str:
    return str(root / "segments" / group / str(year) / "*.parquet")


def has_files(root: Path, group: str, year: int) -> bool:
    return any((root / "segments" / group / str(year)).glob("*.parquet"))


def print_table(title: str, header: list[str], rows: list[list[object]]) -> None:
    print(f"\n== {title} ==")
    if not rows:
        print("(none)")
        return
    table = [header] + [[str(c) for c in r] for r in rows]
    widths = [max(len(r[i]) for r in table) for i in range(len(header))]
    for i, r in enumerate(table):
        print("  ".join(c.ljust(widths[j]) for j, c in enumerate(r)))
        if i == 0:
            print("  ".join("-" * w for w in widths))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--root", type=Path, default=Path("../work"))
    ap.add_argument("--start", type=int, required=True)
    ap.add_argument("--end", type=int, required=True)
    ap.add_argument("--groups", default="red,orange,blue,green,mattapan")
    ap.add_argument("--baseline-year", type=int, default=2025)
    args = ap.parse_args()

    groups = [g.strip() for g in args.groups.split(",") if g.strip()]
    years = list(range(args.start, args.end + 1))
    if args.baseline_year not in years:
        years.append(args.baseline_year)
    years.sort()

    con = duckdb.connect()
    present = [(g, y) for g in groups for y in years if has_files(args.root, g, y)]
    stats: dict[tuple[str, int], tuple[int, float, float]] = {}
    for g, y in present:
        n, dn, bn = con.execute(
            "SELECT count(*), 100.0*avg((distance_mi IS NULL)::INT),"
            " 100.0*avg((benchmark_sec IS NULL)::INT)"
            f" FROM read_parquet('{glob_for(args.root, g, y)}')"
        ).fetchone() or (0, None, None)
        stats[(g, y)] = (n, dn if dn is not None else 0.0, bn if bn is not None else 0.0)

    summary: list[list[object]] = []
    for g, y in present:
        n, dn, bn = stats[(g, y)]
        base = stats.get((g, args.baseline_year))
        if y == args.baseline_year:
            delta = "baseline"
        elif base is not None:
            delta = f"{dn - base[1]:+.2f}"
        else:
            delta = "n/a"
        summary.append([g, y, n, f"{dn:.2f}", f"{bn:.2f}", delta])
    print_table(
        f"Per group per year (delta = distance null pts vs {args.baseline_year}; flag if |delta| > 2)",
        ["group", "year", "segments", "dist_null_%", "bench_null_%", "dist_delta"],
        summary,
    )

    for g in groups:
        for y in years:
            if (g, y) not in stats:
                continue
            src = f"read_parquet('{glob_for(args.root, g, y)}')"
            rows = con.execute(
                f"SELECT car, count(*) n FROM (SELECT unnest(cars) car FROM {src}) GROUP BY car ORDER BY n DESC"
            ).fetchall()
            unknown = [[c, n] for c, n in rows if roster.lookup(g, str(c)) is None]
            print_table(f"{g} {y}: top 10 unknown car numbers (segments)", ["car", "segments"], unknown[:10])

            stops = con.execute(
                f"SELECT from_stop, to_stop, count(*) n FROM {src}"
                " WHERE distance_mi IS NULL AND from_stop <> to_stop"
                " GROUP BY 1, 2 ORDER BY n DESC LIMIT 20"
            ).fetchall()
            print_table(
                f"{g} {y}: top 20 (from_stop, to_stop) with null distance (from != to)",
                ["from_stop", "to_stop", "segments"], [list(r) for r in stops],
            )

        paths = [glob_for(args.root, g, y) for y in years if (g, y) in stats]
        if not paths:
            continue
        src = "read_parquet([" + ",".join(f"'{p}'" for p in paths) + "])"
        if g == "orange":
            last = con.execute(
                f"SELECT car, max(service_date) FROM (SELECT unnest(cars) car, service_date FROM {src})"
                " GROUP BY car ORDER BY car"
            ).fetchall()
            hawker = []
            for c, d in last:
                v = roster.lookup("orange", str(c))
                if v is not None and v.fleet_key == "orange-hawker":
                    hawker.append([c, d])
            print_table("orange: last date each Orange 12xx (orange-hawker) car appears", ["car", "last_date"], hawker)
            if hawker:
                print(f"overall last Orange 12xx date: {max(str(r[1]) for r in hawker)}")


if __name__ == "__main__":
    main()
