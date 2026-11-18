# MBTA Savant — design

*Working name. 2026-11-17.*

## Intent

A just-for-fun site, in the spirit of Baseball Savant, where every MBTA vehicle is a "player":
it has a profile page, a stat line, and red-to-blue percentile bars showing how it stacks up
against its peers. Leaderboards rank the fleet. It's for transit fans browsing for fun. The
newer fleets (CRRC, Type 9, battery buses) should visibly come out ahead because the data
shows it, not because we tilt anything — but advocacy is not the point; fun is.

It is a **separate site** from the Data Dashboard, with its own repo, built on the same data.

## Goals

- A page for every car / bus with a bio, percentile bars, and a game log.
- Leaderboards per ranking group, with season and last-30-days views.
- Fleet-vs-fleet comparison (e.g. CRRC vs Hawker Siddeley on Orange).
- Nightly updates; near-zero hosting cost.

## Non-goals

- Arbitrary date ranges or filters (e.g. "rush hour only") — not in v1 (that's approach B, below).
- Statistically separating one car's effect from the rest of its consist. Every car in a
  train is credited with the train's trip (see Crediting).
- A single combined 0–99 "overall" rating.
- Ferry. Mattapan is shown but not ranked.

## Anti-goals

- Anything that reads as blaming individual operators or workers. No operator data, no
  "worst crew" angles. Cars are the players.
- Presenting itself as an official reliability assessment. It's a fan site; copy should say so.
- An always-on bill (no persistent servers, no database). TransitMatters is a nonprofit.

## Approaches considered

- **A. Static site + nightly precomputed JSON (chosen).** A scheduled job computes every
  stat and percentile for every car and writes JSON to S3; a static React site on CloudFront
  reads it. Cheapest, fastest pages; limited to precomputed windows.
- **B. Nightly job → DynamoDB + Chalice API.** Allows arbitrary ranges/filters. Rejected for
  v1: ongoing cost and complexity for a fun site. A can grow into B later because the daily
  rollups (below) are the same input B would need.
- **C. Compute in the browser from the Dashboard API** (as v5's `byVehicle.ts` does for one
  day). Rejected: percentiles need a full season for every car — far too much data to pull
  into a browser.

The user picked A and a separate site.

## Data sources

All from the TransitMatters performance bucket `tm-mbta-performance`, the same data the
Data Dashboard reads (see `t-performance-dash/server/chalicelib/s3.py` on the `v5` branch):

- LAMP daily events: `Events-lamp/{daily-data|bus-daily-data}/{stop_id}/Year=/Month=/Day=/events.csv`
- Monthly archives: `Events/{monthly-data|monthly-bus-data}/{stop_id}/Year=/Month=/events.csv.gz`
- Commuter Rail daily: `Events-live/daily-cr-data/...`

Each arrival/departure event carries `trip_id`, `vehicle_label`, `vehicle_consist`
(pipe-separated car numbers, e.g. `1940|1941|1966|1967|1959|1958`), and on rapid transit
per-car `occupancy_status` / `occupancy_percentage` aligned with the consist.
`t-performance-dash/server/chalicelib/s3_historical.py` (v5) shows how events are paired into
travel times and dwells by `trip_id`; reuse that logic (copy, not import — separate repo).

Reference data to copy into the new repo:
- Car number → builder / years: `modules/fleet/constants/fleetTypes.ts` (v5). Blue Line has
  no ranges there yet and must be added (Siemens, 0700–0793, 2007–09 — verify).
- Station-to-station distances: `common/constants/station_distances.json` (v5), for speed and
  miles on rail.
- **Vehicle roster: "The MBTA Vehicle Inventory Page"** (unofficial enthusiast publication,
  11/17/26 version, provided by the user as `MBTAInventory.pdf`). It has, per number series,
  builder-model, propulsion, year built, length and seats for every mode (e.g. bus
  `1600-1774 · New Flyer XN40 · CNG · 2016/2017 · 40'`), **bus garage assignments**, Blue Line
  ranges (0700–0793, Siemens, 2007–09), and Commuter Rail locomotive assignments (north/south side).
  Transcribe it by hand into a checked-in `roster.json` (series ranges → attributes, bus → garage),
  updated by hand when a new version comes out. Credit it on the site's About page. This
  replaces the car ranges in v5 `fleetTypes.ts` as the source of truth.
- Bus fleet type for Fleet vs Fleet = **builder-model + year series** (e.g. "XN40 CNG 2016–17"),
  with propulsion as a coarser grouping. Bio card shows builder, model, year, propulsion,
  length and garage. New stat for bus: **Garage** shown on the bio card (not ranked).

## Ranking groups ("leagues")

Percentiles are computed **within a group**. Decided with the user: rank within each line,
except where lines share equipment.

| Group | Ranked against | Note |
|---|---|---|
| Red, Orange, Blue | cars on that line | |
| Green | all Green cars, all branches pooled | same cars run every branch |
| Mattapan | not ranked | bio + game log only |
| Bus (incl. Silver Line) | all buses | buses change routes during a day |
| Commuter Rail | all locomotives / cab cars | only the lead vehicle is reported, so coaches aren't rated |

**Launch order (my call):** subway (Red, Orange, Blue, Green, Mattapan) and bus in v1;
Commuter Rail in v2. Bus has the cleanest data (one bus = one player); subway has the best story.

## Crediting

A trip segment (consecutive stops on one `trip_id`) is credited in full to **every car in the
consist** (falling back to `vehicle_label` when there's no consist; Green labels join cars with
`-`). Over a season, cars rotate through different partners, so the shared credit evens out
well enough for a fun site.

## Metrics

All computed per car per window. **Qualified** = at least 50 trips in the window (my call,
tunable); unqualified cars show stats but no percentile bars and don't appear on leaderboards.

| Metric | Definition | Percentile direction |
|---|---|---|
| **Trip Time Over Expected** (headline) | Mean over segments of min(actual − expected, 300) seconds — delays beyond 5 min count as 5 min (user decision 2026-11-17, after real data showed a few disrupted trips decided ranks), where expected = median segment time for that (route, direction, from-stop, to-stop, hour-of-day bucket, weekday/Sat/Sun) across all vehicles in the window. Used for every group, so one code path. | lower is better |
| **Speed vs Expected** | 100 × (Σ expected / Σ capped actual − 1) over the car's segments: % faster (+) or slower (−) than typical on the same segments/hours. Rail and bus. Replaces Top Speed as a ranked stat (user decision 2026-11-17: Top Speed measured the track, not the car) | higher |
| **Top Speed** | 90th-percentile segment speed (mph), rail only — shown as a fun fact, not ranked | — |
| **On-Time %** | Share of **segments** at or under the MBTA benchmark (`benchmark_travel_time_sec`, which is per stop pair — see v5 `s3_historical.travel_times`). Segments with no benchmark are left out of the denominator. Per segment rather than whole trip, so no first-to-last pairing is needed. (My call.) | higher |
| **Steadiness** | Interquartile range of per-segment (actual − expected) | lower |
| **Door Time** | Median dwell minus expected dwell (same bucketing as above) | lower |
| **Games Played** | Days in service / days in window | higher |
| **Iron Horse** | Longest run of consecutive service days in the window | higher |
| **Miles Logged** | Sum of segment distances (rail); bus via stop-to-stop distance if available, else omitted | higher |
| **Crowd Load** (rail) | Mean per-car `occupancy_percentage`. Likely only newer cars report it — rank only among reporting cars and say so on the page | — (shown, no red/blue judgement) |
| **Usual Teammates** (rail) | Cars most often in the same consist | not ranked |
| **Utility Player** (bus) | Distinct routes run | higher |

Percentile = share of qualified cars in the group the car beats, 0–100.

## Windows and updates

- Season = calendar year; past seasons stay browsable. Plus a rolling **last 30 days**.
- A nightly job processes yesterday's events into **daily segment files** (stored as files in
  the site's own bucket, e.g. Parquet per group per day): one row per trip segment with route,
  direction, from/to stop, hour bucket, day type, consist (list of cars), actual time, dwell,
  benchmark, distance, occupancy. Not compact per-car rows: "expected" is a median over all
  vehicles in the window and Steadiness is an IQR, so neither can be rebuilt from per-car
  summaries. (My call.) The job then recomputes each window's expected times and every car's
  stats from those files. These segment files are also what approach B would load later.
- Game-log rows measure TTOE against the **window's** expected times, so a day's number can shift
  slightly as the season fills in. That's fine for a fun site. (My call.)
- A one-off
  backfill script builds segment files for past days (at least back to Jan 1 of the earliest season shown).
- **Backfill reads LAMP daily files, not the monthly archives** (real-data finding 2026-11-17: archives carry only the lead car on rail and no vehicle on bus). Rail LAMP goes back to 2019; bus LAMP starts 2025-07-30, so the 2025 bus season covers Aug–Dec.
- Only cars in the roster are ranked; labels outside it (junk numbers, work equipment) are excluded. A segment counts for a group only if its route belongs to that group.
- Builder decides how far back to backfill based on data availability (LAMP coverage, consist
  field coverage).

## Output (served JSON)

- `data/{window}/index.json` — every car: number, group, fleet type, qualified flag, headline stats (search + leaderboards).
- `data/{window}/groups/{group}.json` — full stat table + percentiles for the group.
- `data/{window}/cars/{car}.json` — one car: bio, all stats + percentiles, game log (one row
  per service day: trips, miles, TTOE, routes/lines).
- `data/fleets/{group}.json` — fleet-type aggregates per window for fleet-vs-fleet.

`{window}` = `2026`, `2025`, …, `last30`. Exact shapes are the builder's call.

## Site

Static React + TypeScript + Vite, deployed to S3 + CloudFront (same pattern as `cip-tracker` /
`new-train-tracker`). Pages:

- **Home** — top-5 boards per group for a few stats, search by car number.
- **Group leaderboard** — sortable table, all stats, percentile coloring, season/last-30 toggle.
- **Car page** — bio card (builder, year, age, fleet), Savant-style percentile bars, game log,
  and a line map colored by where this car runs faster/slower than expected (rail; v1 may ship
  without the map).
- **Fleet vs Fleet** — per group, fleet types side by side on each stat.

Visual design will be mocked up and agreed with the project owner (the requester) before frontend
work starts. Plan order: data pipeline first (with a plain placeholder UI to check the numbers),
then mockups, then the real frontend.

## Infrastructure

- Domain: **`savant.labs.transitmatters.org`** (decided by the user). Hosted in the same
  TransitMatters AWS account as the Data Dashboard, so the nightly job reads `tm-mbta-performance`
  with a same-account IAM role (my assumption; confirm when setting up deploy credentials).
- New repo, working name `mbta-savant`. Python 3.13 + uv for the job (matches org), React/Vite frontend.
- Nightly job: a scheduled Lambda (e.g. Chalice `@app.schedule`, as in new-train-tracker),
  read access to `tm-mbta-performance`, write to the site bucket. If one run exceeds Lambda's
  15-minute limit, split per group. Builder's call between Lambda and a GitHub Actions cron if
  credentials make Actions simpler.
- Estimate and note hosting cost in the PR, per org convention.
- **Builder's call (made in the plan):** the nightly job runs as a GitHub Actions cron, not Lambda.
  Segment files are Parquet, and stats are computed with DuckDB.

## Left to the builder

JSON shapes, hour-bucket boundaries, how to discover stop IDs per line/route, backfill depth,
handling of out-of-range or unknown car numbers (show as "Unknown fleet", unranked if unqualified),
test strategy, and the job's runtime platform within the constraints above.
