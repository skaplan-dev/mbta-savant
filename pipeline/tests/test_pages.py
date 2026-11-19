import json

from savant import pages
from savant.cli import main

TEMPLATE = """<!doctype html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <title>MBTA Savant</title>
        <meta
            name="description"
            content="generic"
        />
    </head>
    <body><div id="root"></div><script type="module" src="/assets/index-abc.js"></script></body>
</html>
"""


def entry(group, number, **kw):
    return {"car_id": f"{group}:{number}", "group": group, "number": number, "fleet_label": "Red Line #4 (CRRC)",
            "qualified": True, "ranked": True, "travel_vs_typical_sec": -31.6, "pct_travel": 97, **kw}


def write_data(root):
    d = root / "data"
    (d / "2026" / "routes").mkdir(parents=True)
    (d / "last30" / "routes").mkdir(parents=True)
    (d / "meta.json").write_text(json.dumps({
        "generated_at": "2026-11-18T22:59:53+00:00",
        "windows": [{"key": "last30"}, {"key": "2026"}],
        "default_season": {"red": "2026", "mattapan": "last30", "bus": "2026"},
    }))
    (d / "2026" / "index.json").write_text(json.dumps([
        entry("red", "1902"),
        entry("red", "1903", qualified=False, travel_vs_typical_sec=None, pct_travel=None),
        entry("bus", "1400", fleet_label="2014-15 New Flyer XDE40 hybrid", travel_vs_typical_sec=12.4, pct_travel=20),
    ]))
    (d / "last30" / "index.json").write_text(json.dumps([
        entry("red", "1902", travel_vs_typical_sec=-9.0),
        entry("red", "1999"),
        entry("mattapan", "3260", fleet_label="Mattapan PCC", ranked=True),
    ]))
    (d / "2026" / "routes" / "index.json").write_text(json.dumps([
        {"route": "28", "buses": 120, "ranked_cars": 80, "trips": 9000},
        {"route": "742", "buses": 30, "ranked_cars": 0, "trips": 100},
    ]))
    (d / "last30" / "routes" / "index.json").write_text(json.dumps([
        {"route": "742", "buses": 25, "ranked_cars": 12, "trips": 900},
    ]))
    return d


def test_render_replaces_title_description_and_adds_tags():
    out = pages.render(TEMPLATE, 'Car 1 · "Red"', "a & b", "https://x.com/car/red/1", "https://x.com/og.png")
    assert "<title>Car 1 · &quot;Red&quot;</title>" in out
    assert 'content="generic"' not in out
    assert out.count('name="description"') == 1
    assert 'content="a &amp; b"' in out
    assert '<link rel="canonical" href="https://x.com/car/red/1" />' in out
    assert '<meta property="og:image" content="https://x.com/og.png" />' in out
    assert '<script type="module" src="/assets/index-abc.js">' in out  # the app still loads


def test_build_pages_covers_every_page(tmp_path):
    files = pages.build_pages(TEMPLATE, write_data(tmp_path), "mbtasavant.com")
    assert {"index.html", "glossary.html", "line/red.html", "line/bus.html", "line/mattapan.html",
            "car/red/1902.html", "car/red/1903.html", "car/red/1999.html", "car/bus/1400.html",
            "car/mattapan/3260.html", "route/28.html", "route/742.html", "sitemap.xml", "robots.txt"} <= set(files)

    # The default season wins over last30 for a car that ran in both.
    red = files["car/red/1902.html"]
    assert "<title>Car 1902 · Red Line · MBTA Savant</title>" in red
    assert "Car 1902, Red Line #4 (CRRC), saves 32 s of travel time per trip against the typical Red Line car in 2026, ahead of 97% of them." in red
    assert '<link rel="canonical" href="https://mbtasavant.com/car/red/1902" />' in red

    assert "Bus 1400, 2014-15 New Flyer XDE40 hybrid, loses 12 s of travel time per trip against the typical bus in 2026" in (
        files["car/bus/1400.html"])
    assert "trips, service calendar" in files["car/red/1903.html"]  # not qualified: no ranking claim
    assert "trips, service calendar" in files["car/mattapan/3260.html"]  # Mattapan is never ranked
    assert "over the last 30 days" in files["car/red/1999.html"]  # only ran in last30

    assert "2026 Red Line Leaderboard · MBTA Savant" in files["line/red.html"]
    assert "1 cars ranked" in files["line/red.html"]
    # SL2 has no ranked buses in 2026, so its page opens on last30 (as busRoutes.ts does).
    assert "<title>Last 30 Days Route SL2 Leaderboard · MBTA Savant</title>" in files["route/742.html"]
    assert '<link rel="canonical" href="https://mbtasavant.com/" />' in files["index.html"]


def test_sitemap_and_robots(tmp_path):
    files = pages.build_pages(TEMPLATE, write_data(tmp_path), "mbtasavant.com")
    sm = files["sitemap.xml"]
    assert sm.startswith('<?xml version="1.0" encoding="UTF-8"?>')
    assert "<url><loc>https://mbtasavant.com/car/red/1902</loc><lastmod>2026-11-18</lastmod></url>" in sm
    assert sm.count("<url>") == len([f for f in files if f.endswith(".html")])
    assert files["robots.txt"] == "User-agent: *\nAllow: /\n\nSitemap: https://mbtasavant.com/sitemap.xml\n"


def test_cli_writes_files(tmp_path):
    (tmp_path / "index.html").write_text(TEMPLATE)
    data = write_data(tmp_path)
    assert main(["pages", "--template", str(tmp_path / "index.html"), "--data", str(data),
                 "--out", str(tmp_path / "pages"), "--host", "mbtasavant.com"]) == 0
    assert (tmp_path / "pages" / "car" / "red" / "1902.html").exists()
    assert (tmp_path / "pages" / "sitemap.xml").exists()


def test_car_description_rounds_zero_saving_to_matches_typical():
    base = {"group": "red", "number": "1800", "ranked": True, "qualified": True, "pct_travel": 50}
    for vs in (0.0, -0.0, 0.3, -0.3):
        d = pages.car_description({**base, "travel_vs_typical_sec": vs}, "2026")
        assert "Car 1800 matches the typical Red Line car in 2026, ahead of 50% of them." in d
        assert "-0" not in d and "loses" not in d and "saves" not in d
    assert "saves 1 s of travel time per trip" in pages.car_description({**base, "travel_vs_typical_sec": -0.6}, "2026")
    assert "loses 2 s of travel time per trip" in pages.car_description({**base, "travel_vs_typical_sec": 1.6}, "2026")


def test_car_description_leads_with_tar():
    d = pages.car_description(entry("red", "1915", tar=2403, pct_tar=99), "2026")
    assert d.startswith("Car 1915, Red Line #4 (CRRC), was worth 2,403 trips above replacement on the Red Line in 2026, ahead of 99% of them.")


def test_car_description_tar_negative_and_zero():
    neg = pages.car_description(entry("red", "1915", tar=-312, pct_tar=4), "2026")
    assert "was worth 312 trips below replacement" in neg and "-" not in neg.split(".")[0].replace("Red Line #4", "")
    zero = pages.car_description(entry("red", "1915", tar=0, pct_tar=None), "2026")
    assert "matched a replacement-level car" in zero


def test_descriptions_lead_with_tar():
    assert "ranked by TAR (trips above replacement), Time Saved" in pages.line_description("red", "2026", 216)
    r = pages.route_description("28", "2026", {"ranked_cars": 80, "buses": 120})
    assert "by TAR (trips above replacement), Time Saved" in r
    assert "TAR" in pages.HOME_DESCRIPTION and "TAR" in pages.GLOSSARY_DESCRIPTION
