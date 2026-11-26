"""Per-page HTML shells, sitemap.xml and robots.txt for search engines and link previews.

The site is a single-page app: every URL serves the same index.html and the browser fills in the page.
Crawlers that don't run JavaScript (link previews in Slack, iMessage, X) would see one generic title.
This writes a copy of the deployed index.html for every page with its own title, description, canonical
URL and Open Graph tags; a CloudFront Function maps /car/red/1902 to pages/car/red/1902.html.

The template is the deployed index.html, so the shells load the same hashed assets. Run this after every
site deploy (new asset names) and every data build (new numbers).
"""

import html
import json
import re
from pathlib import Path

SITE = "MBTA Savant"
HOME_TITLE = f"{SITE} — every car, every trip"
GLOSSARY_TITLE = f"Stat Glossary · {SITE}"
HOME_DESCRIPTION = (
    "Every MBTA train car and bus with a stat line: trips above replacement (TAR), time saved per trip, "
    "on-schedule rate and more, ranked against its line. Built nightly from the T's own arrival and departure records."
)
GLOSSARY_DESCRIPTION = (
    "How MBTA Savant's stats work: TAR (Trips Above Replacement), Time Saved, Dwell Time, On-Schedule %, Consistency, Iron Horse "
    "Streak and more, and how cars are ranked against their line."
)
OG_IMAGE = "og.png"  # web/public/og.png, 1200x630

# Mirrors web/src/groups.ts.
LINES = {
    "red": ("Red Line", "Car"),
    "orange": ("Orange Line", "Car"),
    "blue": ("Blue Line", "Car"),
    "green": ("Green Line", "Car"),
    "mattapan": ("Mattapan Line", "Car"),
    "bus": ("Bus", "Bus"),
}
UNRANKED_LINES = {"mattapan"}
# Mirrors web/src/busRoutes.ts.
SILVER_LINE = {"741": "SL1", "742": "SL2", "743": "SL3", "746": "SLW", "749": "SL5", "751": "SL4"}
LAST30 = "last30"
CAREER = "career"


def season_label(key: str) -> str:
    return "Last 30 Days" if key == LAST30 else "All-time" if key == CAREER else key


def route_label(route: str) -> str:
    return SILVER_LINE.get(route, route)


def _years_then_last30(windows: list[str]) -> list[str]:
    years = sorted((w for w in windows if w.isdigit()), reverse=True)
    return years + [w for w in windows if w == LAST30]


def car_title(group: str, number: str) -> str:
    line, noun = LINES[group]
    return f"{noun} {number} · {SITE}" if group == "bus" else f"{noun} {number} · {line} · {SITE}"


def car_description(entry: dict, season: str) -> str:
    group, number = entry["group"], entry["number"]
    line, noun = LINES[group]
    fleet = entry.get("fleet_label") or ""
    who = f"{noun} {number}" + (f", {fleet}," if fleet and fleet != "Unknown fleet" else "")
    when = "over the last 30 days" if season == LAST30 else f"in {season}"
    vs_typ = entry.get("travel_vs_typical_sec")
    ranked = group not in UNRANKED_LINES and entry["ranked"] and entry["qualified"] and vs_typ is not None
    if not ranked:
        return (
            f"{who.rstrip(',')}: trips, service calendar and day-by-day game log on the {line} {when}. "
            "Updated nightly from MBTA data."
            if group != "bus"
            else f"{who.rstrip(',')}: trips, routes and day-by-day game log {when}. Updated nightly from MBTA data."
        )
    tar, pct_tar = entry.get("tar"), entry.get("pct_tar")
    if tar is not None:
        rank = f", ahead of {pct_tar}% of them" if pct_tar is not None else ""
        scope = "among MBTA buses" if group == "bus" else f"on the {line}"
        tail = "On-schedule rate, streaks and game log, updated nightly."
        if tar == 0:
            return f"{who} matched a replacement-level car {scope} {when}{rank}. {tail}"
        side = "above" if tar > 0 else "below"
        return f"{who} was worth {abs(tar):,} trips {side} replacement {scope} {when}{rank}. {tail}"
    saved = -vs_typ  # travel_vs_typical_sec is time *over* the typical car; the site shows it as Time Saved
    average = "the typical bus" if group == "bus" else f"the typical {line} car"
    pct = entry.get("pct_travel")
    rank = f", ahead of {pct}% of them" if pct is not None else ""
    r = round(saved)
    if r == 0:
        return f"{who} matches {average} {when}{rank}. On-schedule rate, streaks and game log, updated nightly."
    delta = f"saves {abs(r)} s of travel time per trip" if r > 0 else f"loses {abs(r)} s of travel time per trip"
    return f"{who} {delta} against {average} {when}{rank}. On-schedule rate, streaks and game log, updated nightly."


def line_description(group: str, season: str, ranked: int) -> str:
    line, noun = LINES[group]
    if group in UNRANKED_LINES:
        return (
            f"{season_label(season)} {line} stats for every trolley: trips, miles and service days. "
            "Updated nightly from MBTA data."
        )
    things = "buses" if group == "bus" else "cars"
    return (
        f"{season_label(season)} {line} leaderboard: {ranked:,} {things} ranked by TAR (trips above replacement), "
        "Time Saved, Days in Service and more. Updated nightly from MBTA data."
    )


def route_description(route: str, season: str, entry: dict) -> str:
    return (
        f"{season_label(season)} Route {route_label(route)} leaderboard: {entry['ranked_cars']:,} buses ranked "
        f"by TAR (trips above replacement), Time Saved and more, out of {entry['buses']:,} that ran it. Updated nightly from MBTA data."
    )


def _head_tags(title: str, description: str, url: str, image: str) -> str:
    e = lambda s: html.escape(s, quote=True)  # noqa: E731
    tags = [
        f'<link rel="canonical" href="{e(url)}" />',
        '<meta property="og:type" content="website" />',
        f'<meta property="og:site_name" content="{SITE}" />',
        f'<meta property="og:title" content="{e(title)}" />',
        f'<meta property="og:description" content="{e(description)}" />',
        f'<meta property="og:url" content="{e(url)}" />',
        f'<meta property="og:image" content="{e(image)}" />',
        '<meta property="og:image:width" content="1200" />',
        '<meta property="og:image:height" content="630" />',
        '<meta name="twitter:card" content="summary_large_image" />',
        f'<meta name="twitter:title" content="{e(title)}" />',
        f'<meta name="twitter:description" content="{e(description)}" />',
        f'<meta name="twitter:image" content="{e(image)}" />',
    ]
    return "\n        ".join(tags)


_TITLE = re.compile(r"<title>.*?</title>", re.S)
_DESCRIPTION = re.compile(r'<meta\s+name="description"\s+content="[^"]*"\s*/?>', re.S)


def render(template: str, title: str, description: str, url: str, image: str) -> str:
    if not _TITLE.search(template) or "</head>" not in template:
        raise ValueError("template needs a <title> and a </head>")
    out = _TITLE.sub(lambda _: f"<title>{html.escape(title)}</title>", template, count=1)
    desc = f'<meta name="description" content="{html.escape(description, quote=True)}" />'
    out = _DESCRIPTION.sub(lambda _: desc, out, count=1) if _DESCRIPTION.search(out) else out
    if desc not in out:
        out = out.replace("</head>", f"    {desc}\n    </head>", 1)
    return out.replace("</head>", f"    {_head_tags(title, description, url, image)}\n    </head>", 1)


def _load(path: Path):
    return json.loads(path.read_text()) if path.exists() else None


def build_pages(template: str, data: Path, host: str) -> dict[str, str]:
    """Map of output path (relative to the pages/ folder) -> file contents."""
    base = f"https://{host}"
    image = f"{base}/{OG_IMAGE}"
    meta = _load(data / "meta.json") or {}
    windows = [w["key"] for w in meta.get("windows", [])]
    defaults: dict[str, str] = meta.get("default_season") or {}
    order = _years_then_last30(windows)
    indexes = {w: _load(data / w / "index.json") or [] for w in windows}
    route_indexes = {w: _load(data / w / "routes" / "index.json") or [] for w in windows}

    pages: dict[str, tuple[str, str, str]] = {}  # url path -> (file, title, description)
    pages["/"] = ("index.html", HOME_TITLE, HOME_DESCRIPTION)
    pages["/glossary"] = ("glossary.html", GLOSSARY_TITLE, GLOSSARY_DESCRIPTION)

    for group, (line, _) in LINES.items():
        default = defaults.get(group)
        season = (default if default != CAREER else None) or next((w for w in order if any(e["group"] == group for e in indexes[w])), None)
        if not season:
            continue
        ranked = sum(1 for e in indexes.get(season, []) if e["group"] == group and e["ranked"] and e["qualified"])
        pages[f"/line/{group}"] = (
            f"line/{group}.html",
            f"{season_label(season)} {line} Leaderboard · {SITE}",
            line_description(group, season, ranked),
        )

    # A car's page opens on its line's default season when it ran then, else the newest season it ran.
    cars: dict[tuple[str, str], tuple[dict, str]] = {}
    for w in order:
        for e in indexes[w]:
            key = (e["group"], e["number"])
            if key not in cars or (w == defaults.get(e["group"]) and w != CAREER and cars[key][1] != w):
                cars[key] = (e, w)
    for (group, number), (entry, season) in cars.items():
        pages[f"/car/{group}/{number}"] = (
            f"car/{group}/{number}.html",
            car_title(group, number),
            car_description(entry, season),
        )

    # A route opens on the newest year with ranked buses, else last30, else any season (as busRoutes.ts).
    def route_pref(w: str, r: dict) -> int:
        return 0 if w.isdigit() and r["ranked_cars"] > 0 else 1 if w == LAST30 else 2

    routes: dict[str, tuple[dict, str]] = {}
    for w in order:
        for r in route_indexes[w]:
            have = routes.get(r["route"])
            if have is None or route_pref(w, r) < route_pref(have[1], have[0]):
                routes[r["route"]] = (r, w)
    for route, (entry, season) in routes.items():
        pages[f"/route/{route}"] = (
            f"route/{route}.html",
            f"{season_label(season)} Route {route_label(route)} Leaderboard · {SITE}",
            route_description(route, season, entry),
        )

    out = {
        file: render(template, title, desc, base + path, image)
        for path, (file, title, desc) in pages.items()
    }
    lastmod = (meta.get("generated_at") or "")[:10]
    urls = "\n".join(
        f"  <url><loc>{html.escape(base + path)}</loc>" + (f"<lastmod>{lastmod}</lastmod>" if lastmod else "") + "</url>"
        for path in pages
    )
    out["sitemap.xml"] = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{urls}\n</urlset>\n"
    )
    # /data must stay crawlable: Google renders the app, and the app reads its numbers from there.
    out["robots.txt"] = f"User-agent: *\nAllow: /\n\nSitemap: {base}/sitemap.xml\n"
    return out


def write_pages(template: Path, data: Path, out: Path, host: str) -> int:
    files = build_pages(Path(template).read_text(), Path(data), host)
    for rel, body in files.items():
        p = Path(out) / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(body)
    return len(files)
