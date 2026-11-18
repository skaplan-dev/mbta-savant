# MBTA Savant — Data Pipeline + Placeholder Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A nightly pipeline that turns MBTA arrival/departure events into per-car stats and percentiles, published as static JSON to `savant.labs.transitmatters.org`, with a plain placeholder UI for checking the numbers.

**Architecture:** A Python package (`pipeline/savant`) has three commands. `ingest` turns one service day of S3 events into a Parquet file of trip segments. `build` uses DuckDB over all segment files to compute expected times, per-car stats and percentiles for each window, and writes JSON. `backfill` runs `ingest` over a date range from the monthly archives. A GitHub Actions cron runs `ingest` then `build` each night and syncs to S3. A Vite + React placeholder reads the JSON. The real frontend comes in a later plan, after the user approves mockups.

**Tech Stack:** Python 3.13, uv, boto3, DuckDB (Parquet in and out, SQL for medians, IQR and percentiles; no pandas or pyarrow), pytest. React 19 + TypeScript + Vite. CloudFormation (S3 + CloudFront + ACM) and GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-17-mbta-savant-design.md`

## Global Constraints

- Ranking groups (exact keys): `red`, `orange`, `blue`, `green` (all branches pooled), `mattapan` (never ranked), `bus` (all buses, Silver Line included). `cr` is out of scope for this plan (v2).
- Car identity is **group-scoped**: `car_id = "{group}:{number}"`, e.g. `orange:1400`, `bus:1400`. Bus and rail number ranges collide (bus 1400–1459 vs Orange 1400–1551; bus 1900s vs Red 1900s).
- Only actual events count: `ARR` and `DEP`. Predicted `PRA`/`PRD` are dropped. (Values come from v5 `server/chalicelib/constants.py`.)
- Segments are paired by `(service_date, trip_id)`. Events with an empty `trip_id` are skipped. This matches v5 `s3_historical.py`.
- Crediting: each segment is credited to every car in `vehicle_consist` (split on `|`). If the consist is empty, fall back to `vehicle_label` split on `-` (Green).
- Hour buckets (by departure hour, local): `early` <6, `am_peak` 6–8, `midday` 9–14, `pm_peak` 15–18, `evening` 19–21, `night` ≥22. Day types: `weekday`, `saturday`, `sunday`.
- Expected = median actual segment time over all vehicles in the **window** for the same (route_id, direction, from_stop, to_stop, hour_bucket, day_type). Expected dwell uses the same key on to_stop.
- Qualified = ≥ 50 segments-trips in the window (`QUALIFY_MIN_TRIPS = 50`, where a "trip" = a distinct `(service_date, trip_id)` the car ran).
- Percentile = 100 × (number of qualified cars in the group this car beats) / (n − 1), rounded to an integer, using the metric's "better" direction. n = 1 → 100. Unqualified cars and the `mattapan` group get `null`.
- Windows: one per calendar year present in the segment files (`"2026"`, `"2025"`, …), plus `"last30"` (the 30 service days ending at the latest ingested day).
- Output layout under `data/`: `{window}/index.json`, `{window}/groups/{group}.json`, `{window}/cars/{group}/{number}.json`, `fleets/{group}.json`, `meta.json`.
- Deploys must never delete `data/` or `segments/`: frontend `aws s3 sync --delete` uses `--exclude "data/*" --exclude "segments/*"`.
- Hosting cost: no persistent compute. Estimate the cost in the infra PR.
- Copy dashboard code and data; never import it. The repos stay separate.

**User decisions (already made):**
- "this is mostly just for fun": fun site, not advocacy.
- Rank "against each line… unless things are similar". Encoded in the groups above.
- "i want a seperate site", hosted at `savant.labs.transitmatters.org`.
- "do A": static site with nightly precomputed JSON.
- Roster source: the user's `MBTAInventory.pdf` (unofficial enthusiast inventory, 11/17/26).
- Design doc approved ("looks good").

**Builder calls recorded here (from the spec's "left to the builder"):** the nightly job runs on GitHub Actions cron, not Lambda (free, no 15-minute limit, no packaging, and the org's repos already deploy from Actions). Segment storage is Parquet written by DuckDB. Miles Logged is rail-only in v1, because bus stop-to-stop distances aren't available.

## Review Focus

1. **Car numbers that collide across modes** (bus 1400 vs Orange 1400): they must stay two separate players with separate pages. Test in Task 2 (`test_lookup_is_group_scoped`) and Task 6 (`test_bus_and_orange_1400_are_separate_files`).
2. **A frontend deploy wiping the stats**: `deploy.sh` must exclude `data/*` and `segments/*`. Test in Task 9 (`grep` check in Verify).
3. **A service day with no data** (S3 `NoSuchKey`, outage, or a not-yet-published day): `ingest` writes no file and exits 0, and `build` still succeeds. Games Played counts only days where the group has any data, so cars aren't penalized for an outage. Tests in Task 3 (`test_missing_day_returns_empty`) and Task 5 (`test_games_played_ignores_days_without_group_data`).
4. **Messy rows**: empty `trip_id`, empty consist and label, unknown car numbers, predicted events. They must be skipped or labeled `"Unknown fleet"` without crashing. Tests in Task 4 (`test_skips_rows_without_trip_id`, `test_drops_predicted_events`) and Task 2 (`test_unknown_car_returns_none`).
5. **Tiny groups**: zero or one qualified car in a window (e.g. Blue early in a season, or `last30` right after backfill). Percentiles must not divide by zero. Test in Task 6 (`test_single_qualified_car_gets_100`, `test_no_qualified_cars_all_null`).

---

### Task 0: Scaffold the repo

**Goal:** An empty but runnable repo: a Python package with pytest, a Vite React app, and git initialized.

**Files:**
- Create: `mbta-savant/.gitignore`, `mbta-savant/README.md`, `mbta-savant/pipeline/pyproject.toml`, `mbta-savant/pipeline/savant/__init__.py`, `mbta-savant/pipeline/tests/test_smoke.py`, `mbta-savant/web/` (via `npm create vite@latest web -- --template react-ts`)

**Acceptance Criteria:**
- [ ] `cd pipeline && uv run pytest` passes, with one smoke test
- [ ] `cd web && npm run build` produces `web/dist/index.html`
- [ ] `git log` shows one commit containing the design doc and the plan

**Verify:** `cd mbta-savant/pipeline && uv run pytest -q` → `1 passed`; `cd ../web && npm run build` → exit 0

**Steps:**
- [ ] `git init` in `mbta-savant/`. `.gitignore` covers `node_modules`, `dist`, `.venv`, `work/`, `__pycache__`.
- [ ] `pipeline/pyproject.toml`: project `savant`, `requires-python = ">=3.13"`, deps `boto3`, `duckdb`; dev dep `pytest`; script entry `savant = "savant.cli:main"`.
- [ ] Smoke test: `def test_import(): import savant`.
- [ ] Scaffold `web/` with Vite react-ts. Prettier settings match the org (4 spaces, single quotes, 100 cols).
- [ ] Commit: `chore: scaffold mbta-savant` (with the design doc and plan).

```json:metadata
{"files": ["pipeline/pyproject.toml", "pipeline/savant/__init__.py", "pipeline/tests/test_smoke.py", "web/package.json"], "verifyCommand": "cd pipeline && uv run pytest -q", "acceptanceCriteria": ["pytest passes with smoke test", "web builds", "initial commit exists"], "modelTier": "mechanical"}
```

---

### Task 1: Reference data and group mapping

**Goal:** Know which stop IDs belong to each group, which station each stop is, and the distance between stations.

**Files:**
- Create: `pipeline/savant/data/stations.json` (copy of v5 `common/constants/stations.json`), `pipeline/savant/data/station_distances.json` (copy of v5 `common/constants/station_distances.json`), `pipeline/savant/data/bus_constants/*.json` (copy of v5 `common/constants/bus_constants/`, **excluding** `*-legacy.json`)
- Create: `pipeline/savant/groups.py`
- Test: `pipeline/tests/test_groups.py`

**Interfaces:**
- `GROUPS: tuple[str, ...] = ("red", "orange", "blue", "green", "mattapan", "bus")`
- `group_for_route(route_id: str) -> str | None`: `Red`→red, `Orange`→orange, `Blue`→blue, `Green-B|C|D|E`→green, `Mattapan`→mattapan, a bus route or Silver Line route id → bus, `CR-*`/`Boat-*`/unknown → None
- `stop_ids(group: str) -> list[str]`: every platform stop id for the group, from `stations.json` (rail) or the union of bus_constants files (bus), de-duplicated
- `station_for_stop(stop_id: str) -> str | None`: rail stop id → `place-*`
- `distance_miles(from_station: str, to_station: str) -> float | None`: from `station_distances.json`, symmetric lookup

**Acceptance Criteria:**
- [ ] `group_for_route("Green-D") == "green"`, `group_for_route("28") == "bus"`, `group_for_route("742") == "bus"`, `group_for_route("CR-Lowell") is None`
- [ ] `stop_ids("red")` contains `"70061"`, and `stop_ids("bus")` contains `"28-1-1728"`
- [ ] `distance_miles("place-wondl", "place-rbmnl") ≈ 0.386` and gives the same value when the stations are swapped

**Verify:** `uv run pytest tests/test_groups.py -v` → all pass

**Steps:**
- [ ] Write those assertions as tests, see them fail, implement, see them pass. Load the JSON with `importlib.resources`.
- [ ] Commit: `feat: reference data and group mapping`

```json:metadata
{"files": ["pipeline/savant/groups.py", "pipeline/savant/data/stations.json", "pipeline/savant/data/station_distances.json", "pipeline/tests/test_groups.py"], "verifyCommand": "cd pipeline && uv run pytest tests/test_groups.py -v", "acceptanceCriteria": ["route->group mapping", "stop ids per group", "symmetric distances"], "modelTier": "standard"}
```

---

### Task 2: Vehicle roster

**Goal:** Every car and bus number maps to its builder, model, years, propulsion, fleet key and (for buses) garage, transcribed from the user's inventory PDF.

**Files:**
- Create: `pipeline/savant/data/roster.json`, `pipeline/savant/roster.py`
- Test: `pipeline/tests/test_roster.py`

**Interfaces:**
- `roster.json`:
  `{"source": "The MBTA Vehicle Inventory Page, 11/17/26 version", "series": [{"group", "from", "to", "fleet_key", "fleet_label", "builder", "model", "propulsion", "years", "length_ft"}], "garages": [{"name", "from", "to"}]}`.
  Series only for groups in scope (red, orange, blue, green, mattapan, bus). Garages from "Bus Assignments as of 11/03/2026". Listed single numbers become one-number ranges.
- `@dataclass(frozen=True) class Vehicle: group, number, fleet_key, fleet_label, builder, model, propulsion, years, length_ft, garage: str | None`
- `lookup(group: str, number: str) -> Vehicle | None`: compares by integer value (`"0700"` and `"700"` both match Blue 0700)

**Acceptance Criteria:**
- [ ] `lookup("bus", "1600").model == "XN40"`, `.propulsion == "cng"`, `.garage == "Arborway"`
- [ ] `lookup("orange", "1400").builder == "CRRC"` and `lookup("bus", "1400").model == "XDE40"` (`test_lookup_is_group_scoped`)
- [ ] `lookup("blue", "0700").builder == "Siemens"`
- [ ] `lookup("red", "9999") is None` (`test_unknown_car_returns_none`)
- [ ] No two series in the same group overlap (a test over the whole file)

**Verify:** `uv run pytest tests/test_roster.py -v` → all pass

**Steps:**
- [ ] Extract the PDF text with `uvx --from pypdf python -I -c "..."` (`/Users/sethkaplan/Downloads/MBTAInventory.pdf`, rail on pages 1–4 and bus on pages 12–13), then transcribe into `roster.json` by hand. Propulsion values: `diesel`, `hybrid`, `cng`, `battery`, `electric` (rail). Fleet keys look like `red-crrc`, `bus-xn40-2016`.
- [ ] Write the tests, then implement `lookup`, keeping the parsed roster in a module-level cache.
- [ ] Commit: `feat: vehicle roster from MBTA inventory`

```json:metadata
{"files": ["pipeline/savant/data/roster.json", "pipeline/savant/roster.py", "pipeline/tests/test_roster.py"], "verifyCommand": "cd pipeline && uv run pytest tests/test_roster.py -v", "acceptanceCriteria": ["bus 1600 is XN40 CNG at Arborway", "group-scoped lookup", "blue 0700 Siemens", "unknown returns None", "no overlapping series"], "modelTier": "standard"}
```

---

### Task 3: Event download

**Goal:** Fetch all actual arrival/departure rows for a group on one service day (from LAMP daily files) or for a month (from the monthly archive).

**Files:**
- Create: `pipeline/savant/events.py`
- Test: `pipeline/tests/test_events.py` (boto3 stubbed with `botocore.stub.Stubber` or a fake client passed in)

**Interfaces:**
- `BUCKET = "tm-mbta-performance"`
- `day_events(group: str, day: date, client=None) -> list[dict]`: reads `Events-lamp/{daily-data|bus-daily-data}/{stop_id}/Year={y}/Month={m}/Day={d}/events.csv` for every `stop_ids(group)`, with a thread pool of 25. Missing keys are skipped. Rows are CSV dicts. Only `event_type in ("ARR", "DEP")` is kept.
- `month_events(group: str, year: int, month: int, client=None) -> list[dict]`: reads `Events/{monthly-data|monthly-bus-data}/{stop_id}/Year=/Month=/events.csv.gz` (zlib with `MAX_WBITS | 32`), same filtering.
- The download and decode logic is copied from v5 `server/chalicelib/s3.py` (`download`, `_lamp_key`, `_historic_key`), trimmed to these two paths.

**Acceptance Criteria:**
- [ ] When every key is `NoSuchKey`, `day_events` returns `[]` without raising (`test_missing_day_returns_empty`)
- [ ] `PRA`/`PRD` rows are dropped (`test_drops_predicted_events`)
- [ ] Any S3 error other than `NoSuchKey` propagates

**Verify:** `uv run pytest tests/test_events.py -v` → all pass

**Steps:** TDD with a fake client whose `get_object` returns canned CSV bytes or raises `ClientError`. Commit: `feat: event download`.

```json:metadata
{"files": ["pipeline/savant/events.py", "pipeline/tests/test_events.py"], "verifyCommand": "cd pipeline && uv run pytest tests/test_events.py -v", "acceptanceCriteria": ["missing day returns empty", "predicted events dropped", "other S3 errors raise"], "modelTier": "standard"}
```

---

### Task 4: Segments

**Goal:** Turn event rows into trip-segment rows, and write and read one Parquet file per group per service day.

**Files:**
- Create: `pipeline/savant/segments.py`
- Test: `pipeline/tests/test_segments.py`, `pipeline/tests/fixtures/orange_day.csv` (about 20 hand-made rows: 2 trips, 4 stops each, one row with no trip_id, one PRA row, one consist-less Green-style row)

**Interfaces:**
- Segment row (dict, and the Parquet columns): `service_date: str (YYYY-MM-DD)`, `group`, `route_id`, `direction: int`, `trip_id`, `from_stop`, `to_stop`, `dep_time: str ISO` (departure from from_stop), `hour_bucket`, `day_type`, `travel_sec: float` (to_stop ARR − from_stop DEP), `dwell_sec: float | None` (to_stop DEP − to_stop ARR, None at the last stop), `benchmark_sec: float | None` (difference of `scheduled_tt` between the two stops when both are present, as in v5 `s3_historical.travel_times`), `distance_mi: float | None` (rail via `station_for_stop` + `distance_miles`, None for bus), `cars: list[str]`, `occupancy_pct: list[float | None]` (aligned with cars; empty when not reported)
- `build_segments(group: str, rows: list[dict]) -> list[dict]`: groups by `(service_date, trip_id)`, sorts by event time, and pairs each stop's DEP with the next stop's ARR. A re-arrival within 60 s of the same stop's DEP is the same stop (`SAME_STOP_REARRIVAL_SEC = 60`, from v5). Skips rows with an empty trip_id and segments with `travel_sec <= 0`.
- `hour_bucket(dt: datetime) -> str` and `day_type(service_date: date) -> str`, using the Global Constraints values
- `write_day(segments: list[dict], root: Path, group: str, day: date) -> Path | None`: writes `root/segments/{group}/{YYYY}/{YYYY-MM-DD}.parquet` with DuckDB. Returns None and writes nothing for an empty list.
- `segment_glob(root: Path, group: str) -> str`: the glob string for DuckDB `read_parquet`

**Acceptance Criteria:**
- [ ] The fixture yields exactly 6 segments, and `cars == ["1402","1403","1404","1405","1406","1407"]` for the consist `1402|1403|1404|1405|1406|1407`
- [ ] The Green-style row with an empty consist and label `3901-3850` yields `cars == ["3901","3850"]`
- [ ] `test_skips_rows_without_trip_id` passes
- [ ] `hour_bucket` at 06:00 is `am_peak`, at 05:59 is `early`, and at 22:00 is `night`
- [ ] `write_day([], …)` returns None and creates no file

**Verify:** `uv run pytest tests/test_segments.py -v` → all pass

**Steps:** TDD from the fixture, then commit `feat: trip segments`.

```json:metadata
{"files": ["pipeline/savant/segments.py", "pipeline/tests/test_segments.py", "pipeline/tests/fixtures/orange_day.csv"], "verifyCommand": "cd pipeline && uv run pytest tests/test_segments.py -v", "acceptanceCriteria": ["6 segments from fixture", "consist split", "green label fallback", "skip no trip_id", "bucket boundaries", "empty write returns None"], "modelTier": "frontier"}
```

---

### Task 5: Window stats

**Goal:** Use DuckDB SQL to compute every per-car metric for a group and window from the segment files.

**Files:**
- Create: `pipeline/savant/stats.py`
- Test: `pipeline/tests/test_stats.py` (writes small synthetic segment Parquet files to `tmp_path` with `write_day`)

**Interfaces:**
- `@dataclass class Window: key: str; start: date; end: date`
- `windows(root: Path) -> list[Window]`: one per calendar year with any segment file, plus `last30`, which ends at the latest file's date
- `car_stats(root: Path, group: str, window: Window) -> list[dict]`. Each dict has `car_id`, `number`, `trips`, `qualified`, `ttoe_sec`, `top_speed_mph`, `on_time_pct`, `steadiness_sec`, `door_time_sec`, `games_played_pct`, `iron_horse_days`, `miles`, `crowd_load_pct`, `teammates: list[[number, count]]` (top 5, rail only), `routes: int` (bus only), `game_log: list[{date, trips, miles, ttoe_sec, routes: list[str]}]`
- Definitions (from the spec):
  - TTOE = mean(travel_sec − expected_travel)
  - top speed = p90 of distance_mi / travel_sec × 3600 where distance_mi is known
  - on-time = share of segments with travel_sec ≤ benchmark_sec, among segments that have a benchmark
  - steadiness = p75 − p25 of (travel_sec − expected)
  - door time = median(dwell_sec − expected_dwell)
  - games played = car's service days / days in window where **the group has any segments**
  - Iron Horse = longest run of consecutive service days, counted over the group's data days
  - miles = sum distance_mi
  - crowd load = mean of the car's own non-null occupancy_pct
  - Unnest `cars` so each car gets each segment.

**Acceptance Criteria:**
- [ ] On synthetic data where car A always runs 10 s faster than car B on the same segments, `A.ttoe_sec < 0 < B.ttoe_sec` and the two are 10 s apart
- [ ] `test_games_played_ignores_days_without_group_data`: 10 calendar days, group data on 8, car runs on all 8 → `games_played_pct == 100`
- [ ] A car with 49 trips gets `qualified == False`, and one with 50 gets `True`
- [ ] Iron Horse is 3 for service days {1,2,3,5}
- [ ] `on_time_pct` is None when no segment has a benchmark
- [ ] Bus rows have `top_speed_mph is None` and `miles is None`

**Verify:** `uv run pytest tests/test_stats.py -v` → all pass

**Steps:** TDD. Write one SQL statement per metric family (expected CTE → per-segment deltas → per-car aggregates) using `median`, `quantile_cont`, and `unnest`. Iron Horse can use a gaps-and-islands query or Python over the sorted dates. Commit: `feat: window stats`.

```json:metadata
{"files": ["pipeline/savant/stats.py", "pipeline/tests/test_stats.py"], "verifyCommand": "cd pipeline && uv run pytest tests/test_stats.py -v", "acceptanceCriteria": ["ttoe separates fast/slow car", "games played ignores no-data days", "qualify threshold 50", "iron horse streak", "on-time null without benchmark", "bus has no speed/miles"], "modelTier": "frontier"}
```

---

### Task 6: Percentiles and JSON publishing

**Goal:** Rank cars within their group and write the static JSON files the site reads.

**Files:**
- Create: `pipeline/savant/publish.py`
- Test: `pipeline/tests/test_publish.py`

**Interfaces:**
- `METRICS: dict[str, Literal["higher", "lower"] | None]` = ttoe_sec lower, top_speed_mph higher, on_time_pct higher, steadiness_sec lower, door_time_sec lower, games_played_pct higher, iron_horse_days higher, miles higher, routes higher, crowd_load_pct None (shown, not ranked)
- `add_percentiles(group: str, cars: list[dict]) -> list[dict]`: adds `pct: {metric: int | None}` using the Global Constraints formula. Cars with a None value for a metric get None for it, and the rest are ranked without them.
- `publish(root: Path, out: Path) -> None`: for every window and group, writes `out/data/{window}/groups/{group}.json` (`{group, window, generated_at, cars: [...]}` without game logs), `out/data/{window}/cars/{group}/{number}.json` (the car's stats, pct, game_log, and `vehicle` from `roster.lookup`, or `{"fleet_label": "Unknown fleet"}`), `out/data/{window}/index.json` (`[{car_id, group, number, fleet_label, qualified, ttoe_sec, pct_ttoe}]`), `out/data/fleets/{group}.json` (per window, the median of each metric per fleet_key among qualified cars), and `out/data/meta.json` (`{generated_at, windows, latest_service_date}`)

**Acceptance Criteria:**
- [ ] `test_single_qualified_car_gets_100`
- [ ] `test_no_qualified_cars_all_null`
- [ ] With three qualified cars where ttoe = −5, 0, 5, pct_ttoe = 100, 50, 0
- [ ] `test_bus_and_orange_1400_are_separate_files`: `cars/bus/1400.json` and `cars/orange/1400.json` both exist with different `vehicle.model`
- [ ] Mattapan cars always have `pct` values of None

**Verify:** `uv run pytest tests/test_publish.py -v` → all pass

**Steps:** TDD, then commit `feat: percentiles and publishing`.

```json:metadata
{"files": ["pipeline/savant/publish.py", "pipeline/tests/test_publish.py"], "verifyCommand": "cd pipeline && uv run pytest tests/test_publish.py -v", "acceptanceCriteria": ["single car 100", "no qualified all null", "3-car percentiles 100/50/0", "bus/orange 1400 separate", "mattapan unranked"], "modelTier": "standard"}
```

---

### Task 7: CLI and end-to-end test

**Goal:** `savant ingest`, `savant build` and `savant backfill` wire the pieces together.

**Files:**
- Create: `pipeline/savant/cli.py`
- Test: `pipeline/tests/test_cli.py` (end-to-end with a fake S3 client serving `fixtures/orange_day.csv` for two days)

**Interfaces:**
- `savant ingest --date YYYY-MM-DD [--groups red,orange,...] --root ./work`: for each group, `day_events` → `build_segments` → `write_day`. Logs `"{group} {date}: N segments"` and exits 0 even when N = 0.
- `savant backfill --start YYYY-MM-DD --end YYYY-MM-DD --root ./work`: uses `month_events` once per month, splits rows by `service_date`, and writes every day in range. A day whose file already exists is skipped unless `--force`.
- `savant build --root ./work --out ./out`: calls `publish(root, out)`.
- Default groups: all of `GROUPS`.

**Acceptance Criteria:**
- [ ] Ingesting two fixture days, then building, produces `out/data/meta.json`, `out/data/2026/groups/orange.json`, and at least one `out/data/2026/cars/orange/*.json`
- [ ] Ingesting a day with no data exits 0 and writes no segment file

**Verify:** `uv run pytest -q` → the whole suite passes

**Steps:** Use argparse and inject the S3 client through a module-level factory so tests can swap it. Commit: `feat: savant CLI`.

```json:metadata
{"files": ["pipeline/savant/cli.py", "pipeline/tests/test_cli.py"], "verifyCommand": "cd pipeline && uv run pytest -q", "acceptanceCriteria": ["ingest+build produces expected files", "empty day exits 0 with no file"], "modelTier": "standard"}
```

---

### Task 8: Placeholder UI

**Goal:** A plain page for checking the numbers: a group leaderboard and a car page, reading `/data/...` JSON.

**Files:**
- Modify: `web/src/App.tsx`
- Create: `web/src/api.ts`, `web/src/Leaderboard.tsx`, `web/src/CarPage.tsx`
- Modify: `web/vite.config.ts` (dev server serves `../out` as static `/data` via `publicDir` or a proxy)

**Interfaces:**
- Query-param routing, so there's no SPA fallback yet: `?window=2026&group=orange` shows the leaderboard, and `?window=2026&car=orange:1400` shows the car page. The default is the latest season with group `red`.
- Leaderboard: a sortable `<table>` with one column per metric, each value followed by `(pct)`, and unqualified cars greyed out at the bottom.
- Car page: the vehicle bio fields, a stat/percentile table, and the game log table.
- A footer credits "Vehicle data: The MBTA Vehicle Inventory Page (unofficial)" and says "A TransitMatters Labs fan site, not an official MBTA assessment."

**Acceptance Criteria:**
- [ ] With `out/` from Task 7, `npm run dev` shows the orange leaderboard with rows, and clicking a car opens its page
- [ ] `npm run build` and `npx tsc --noEmit` pass

**Verify:** `cd web && npx tsc --noEmit && npm run build` → exit 0, plus a manual check in the browser

**Steps:** Build it, then commit `feat: placeholder UI`.

```json:metadata
{"files": ["web/src/App.tsx", "web/src/api.ts", "web/src/Leaderboard.tsx", "web/src/CarPage.tsx", "web/vite.config.ts"], "verifyCommand": "cd web && npx tsc --noEmit && npm run build", "acceptanceCriteria": ["leaderboard renders from out/", "car page renders", "typecheck and build pass"], "modelTier": "standard"}
```

---

### Task 9: Hosting, deploy and nightly job

**Goal:** `savant.labs.transitmatters.org` is served from S3 + CloudFront, and a nightly GitHub Action ingests yesterday, rebuilds the stats and publishes.

**Files:**
- Create: `cloudformation.json`, `deploy.sh` (both modeled on `cip-tracker/cloudformation.json` and `cip-tracker/deploy.sh`), `.github/workflows/deploy.yml` (on push to main, runs deploy.sh), `.github/workflows/nightly.yml`

**Interfaces:**
- Stack: an S3 bucket, a CloudFront distribution with an ACM certificate for `savant.labs.transitmatters.org`, and the same DNS setup cip-tracker uses. The bucket name is exported as a stack output.
- `deploy.sh`: builds `web/`, then `aws s3 sync web/dist s3://$BUCKET --delete --exclude "data/*" --exclude "segments/*"`, then invalidates CloudFront.
- `nightly.yml`: cron `0 10 * * *` (05:00/06:00 Boston, after LAMP publishes), plus `workflow_dispatch` with an optional `date` input. Steps: `aws s3 sync s3://$BUCKET/segments ./work/segments` → `savant ingest --date <yesterday> --root ./work` → `savant build --root ./work --out ./out` → `aws s3 sync ./work/segments s3://$BUCKET/segments` → `aws s3 sync ./out/data s3://$BUCKET/data --delete` → invalidate `/data/*`.
- The IAM user/role for Actions needs read on `tm-mbta-performance` and write on the site bucket. Credentials come from repo secrets, the same way cip-tracker's deploy workflow gets them.

**Acceptance Criteria:**
- [ ] `grep -c 'exclude "data/\*"' deploy.sh` ≥ 1 and `grep -c 'exclude "segments/\*"' deploy.sh` ≥ 1
- [ ] `aws cloudformation validate-template --template-body file://cloudformation.json` succeeds
- [ ] A cost estimate comment at the top of `cloudformation.json` (S3 storage for about 1 GB of segments per year, CloudFront at hobby traffic, and Actions minutes, which are free for public repos)
- [ ] After the first deploy, `curl -sI https://savant.labs.transitmatters.org` returns 200

**Verify:** the two greps and `validate-template`. The live `curl` needs AWS credentials and DNS, which the user must provide or approve. Pause and ask before the first `cloudformation deploy`.

**Steps:** Write the files, run the checks, and commit `feat: hosting and nightly job`. **Stop before deploying** and ask the user which AWS profile to use and to approve creating the stack.

```json:metadata
{"files": ["cloudformation.json", "deploy.sh", ".github/workflows/deploy.yml", ".github/workflows/nightly.yml"], "verifyCommand": "grep -c 'exclude \"data/\\*\"' deploy.sh && aws cloudformation validate-template --template-body file://cloudformation.json", "acceptanceCriteria": ["deploy excludes data/ and segments/", "template validates", "cost estimate present", "site returns 200 after approved deploy"], "modelTier": "standard"}
```

---

### Task 10: Real-data backfill and sanity check

**Goal:** Backfill 2025 and 2026 to date from real data, and check the numbers against the Data Dashboard before any design work starts.

**Files:**
- Create: `docs/sanity-check-2026-11.md` (findings)

**Acceptance Criteria:**
- [ ] `savant backfill --start 2025-01-01 --end <yesterday>` completes, and the doc records its runtime and total segment file size
- [ ] For three cars (one Orange CRRC, one Red Bombardier, one bus), the median segment travel time on one chosen day matches the dashboard's v5 "By vehicle" chart (`TravelTimesByVehicleChart`) for the same stations within ±5%. The doc records each comparison.
- [ ] The doc lists the top 5 and bottom 5 cars by TTOE percentile for red and orange, plus the fleet medians. It notes whether new fleets lead, as expected, or anything looks off.
- [ ] `savant build` runtime over the full backfill is recorded and fits comfortably within the Actions limits (< 30 min)

**Verify:** the doc exists with all four sections filled from real output

**Steps:** Run the backfill locally with AWS read credentials (ask the user for the profile), compare, write up, and commit `docs: real-data sanity check`. Bring anything surprising to the user before moving on to mockups.

```json:metadata
{"files": ["docs/sanity-check-2026-11.md"], "verifyCommand": "test -s docs/sanity-check-2026-11.md", "acceptanceCriteria": ["backfill completes with runtime recorded", "3 cars match dashboard within 5%", "top/bottom 5 and fleet medians listed", "build runtime under 30 min"], "modelTier": "frontier"}
```

---

---

## Amendment (2026-11-17): real-data fixes, Tasks 11–15

Source: `docs/sanity-check-2026-11.md`. **User decisions (made after the real-data check):** "Cap big delays": TTOE counts any delay over 5 minutes as 5 minutes. "Speed vs expected" replaces Top Speed as the ranked stat, and Top Speed stays as an unranked fun fact. Controller rulings (sanity-check findings with one obvious fix): backfill from LAMP, filter segments by route group, rank only roster cars, S3 retries, build memory, nightly segment cache.

### Task 11: Backfill from LAMP, S3 retries, local credentials

**Goal:** `savant backfill` builds history from LAMP daily files, which carry the full consist and occupancy, instead of the monthly archives. S3 reads survive transient errors.

**Files:**
- Modify: `pipeline/savant/cli.py` (backfill), `pipeline/savant/events.py` (retries), `pipeline/pyproject.toml` (`botocore[crt]`)
- Test: `pipeline/tests/test_cli.py`, `pipeline/tests/test_events.py`

**Interfaces:**
- `savant backfill --start --end [--groups] [--workers N=5] [--force] --root`: runs `day_events` → `build_segments` → `write_day` for every day in range. Days run in parallel across N worker threads. Existing day files are skipped unless `--force`. `--end` before `--start` exits 2 with a message.
- `month_events` stays in events.py but nothing calls it any more. Delete it, along with its tests (YAGNI).
- Retries: the boto3 client uses `Config(retries={"max_attempts": 8, "mode": "adaptive"})`. Reading a body retries up to 3 times on `urllib3.exceptions.ProtocolError`, `botocore.exceptions.ResponseStreamingError` or `ConnectionError`, with backoff of 1 s, 2 s, then 4 s, and re-raises after the last attempt.
- Add `botocore[crt]` to the dependencies, so local `aws login` credentials work.

**Acceptance Criteria:**
- [ ] A backfill over 3 fixture days writes 3 day files through `day_events`. The test's fake client records that no `Events/monthly-*` key was requested.
- [ ] `--end` before `--start` exits with code 2
- [ ] A read whose body raises ProtocolError twice and then succeeds returns rows. One that raises 4 times propagates the error.

**Verify:** `cd pipeline && uv run pytest -q` → all pass

```json:metadata
{"files": ["pipeline/savant/cli.py", "pipeline/savant/events.py", "pipeline/pyproject.toml", "pipeline/tests/test_cli.py", "pipeline/tests/test_events.py"], "verifyCommand": "cd pipeline && uv run pytest -q", "acceptanceCriteria": ["backfill uses LAMP day files only", "end<start exits 2", "body read retries 3x then raises"], "modelTier": "standard"}
```

---

### Task 12: Group filtering and roster-only ranking

**Goal:** A segment counts only for the group its route belongs to. Only cars that are in the roster get percentiles.

**Files:**
- Modify: `pipeline/savant/segments.py` (`build_segments` drops segments where `group_for_route(route_id) != group`), `pipeline/savant/publish.py`
- Test: `pipeline/tests/test_segments.py`, `pipeline/tests/test_publish.py`

**Interfaces:**
- `build_segments`: a Red route_id segment handed to group `mattapan` is dropped. Car tokens that are not all digits (e.g. `WIRE`, `None`, an empty string) are removed from `cars`, along with the matching `occupancy_pct` entry. If no cars are left, the segment is dropped.
- `publish.add_percentiles`: a car with `roster.lookup(group, number) is None` gets every pct set to None and is left out of n. Its stats and car page are still published, and its index/leaderboard rows carry `"ranked": false`. Roster cars carry `"ranked": true` (also false for every mattapan car).

**Acceptance Criteria:**
- [ ] A segment with route_id `Red` passed to `build_segments("mattapan", …)` is dropped (`test_route_outside_group_dropped`)
- [ ] The consist `3901|WIRE` gives `cars == ["3901"]`, with occupancy aligned
- [ ] Two qualified green cars, `3901` (in the roster) and `3000` (not in it): `3901` gets pct 100 with n=1, and `3000` gets all-None pct and `ranked == false`

**Verify:** `cd pipeline && uv run pytest -q` → all pass

```json:metadata
{"files": ["pipeline/savant/segments.py", "pipeline/savant/publish.py", "pipeline/tests/test_segments.py", "pipeline/tests/test_publish.py"], "verifyCommand": "cd pipeline && uv run pytest -q", "acceptanceCriteria": ["off-group route dropped", "non-numeric car tokens removed", "non-roster cars unranked and excluded from n"], "modelTier": "standard"}
```

---

### Task 13: Capped TTOE, Speed vs Expected, build memory

**Goal:** The headline stat ignores disruption-scale outliers. Speed vs Expected becomes a ranked stat. The build fits a 7 GB runner.

**Files:**
- Modify: `pipeline/savant/stats.py`, `pipeline/savant/publish.py` (METRICS), `web/src/api.ts`, `web/src/Leaderboard.tsx`, `web/src/CarPage.tsx`
- Test: `pipeline/tests/test_stats.py`, `pipeline/tests/test_publish.py`

**Interfaces:**
- `TTOE_CAP_SEC = 300`. Per segment `delta = least(travel_sec − expected, 300)`. This delta feeds `ttoe_sec`, `steadiness_sec` and the game-log TTOE. There is no lower cap.
- `speed_vs_expected_pct = 100 × (Σ expected / Σ least(travel_sec, expected + 300) − 1)` over the car's segments. It covers rail and bus and is null if the car has no segments. Add it to the stats dict and to `METRICS` as `"higher"`.
- `top_speed_mph` keeps its definition, but its METRICS entry becomes `None` (shown, not ranked).
- Memory: `seg` projects only the columns it uses (no `SELECT *`). The connection sets `memory_limit='4GB'` and a `temp_directory` under `root/.duckdb_tmp`.
- Add the deferred regression test: a 1-car and a 3-car train on the same segment, where expected is the plain median of the two travel times.
- The web types and tables gain `speed_vs_expected_pct`, with its pct. Top Speed is shown without a pct.

**Acceptance Criteria:**
- [ ] A car with one segment 3,600 s over expected and nine at expected has `ttoe_sec == 30.0` (that is, (300 + 0×9)/10)
- [ ] A car 10% faster than expected on every segment has `speed_vs_expected_pct ≈ 11.1`, and one 10% slower ≈ −9.1
- [ ] `METRICS["top_speed_mph"] is None` and `METRICS["speed_vs_expected_pct"] == "higher"`
- [ ] `test_multi_car_train_weighted_once` passes
- [ ] `npx tsc --noEmit && npm run build` in web/ exits 0

**Verify:** `cd pipeline && uv run pytest -q && cd ../web && npx tsc --noEmit && npm run build`

```json:metadata
{"files": ["pipeline/savant/stats.py", "pipeline/savant/publish.py", "pipeline/tests/test_stats.py", "pipeline/tests/test_publish.py", "web/src/api.ts", "web/src/Leaderboard.tsx", "web/src/CarPage.tsx"], "verifyCommand": "cd pipeline && uv run pytest -q && cd ../web && npx tsc --noEmit && npm run build", "acceptanceCriteria": ["ttoe capped at 300s per segment", "speed_vs_expected_pct ranked higher", "top speed unranked", "multi-car weighting regression test", "web builds"], "modelTier": "frontier"}
```

---

### Task 14: Nightly segment cache and corrected cost estimate

**Goal:** The nightly job stops downloading every segment from S3 each night.

**Files:**
- Modify: `.github/workflows/nightly.yml`, `cloudformation.json` (cost text)

**Interfaces:**
- Use `actions/cache` for `work/segments`, with key `segments-${{ github.run_id }}` and restore-keys `segments-` (always restore the newest and save a new one).
- On a cache miss, fall back to `aws s3 sync s3://$BUCKET/segments ./work/segments`. On a hit, skip the full pull.
- After ingest, push only the new day's files with `aws s3 cp` for each `work/segments/*/YYYY/<date>.parquet`. S3 stays the durable copy.
- Cost text: S3 egress about $0.0/night with a cache hit, or about $0.07 for a full pull on a miss (740 MB). LAMP reads are about 65 MB/night (about $0.20/month). Total well under $1/month. Update both the Description and Metadata, and the nightly.yml header.

**Acceptance Criteria:**
- [ ] nightly.yml has the actions/cache step, a pull step conditional on `cache-hit != 'true'`, and a per-day push (no full sync of segments up)
- [ ] YAML parses and the cloudformation.json JSON is valid
- [ ] `grep -c 'cache-hit' .github/workflows/nightly.yml` ≥ 1

**Verify:** `python3 -c "import yaml,sys;yaml.safe_load(open('.github/workflows/nightly.yml'))" && python3 -m json.tool cloudformation.json >/dev/null`

```json:metadata
{"files": [".github/workflows/nightly.yml", "cloudformation.json"], "verifyCommand": "python3 -c \"import yaml;yaml.safe_load(open('.github/workflows/nightly.yml'))\" && python3 -m json.tool cloudformation.json >/dev/null", "acceptanceCriteria": ["actions/cache with miss fallback", "per-day segment push", "cost text updated"], "modelTier": "standard"}
```

---

### Task 15: Re-run on real data with LAMP

**Goal:** Rebuild the full history from LAMP and confirm the fixes on real data.

**Files:**
- Modify: `docs/sanity-check-2026-11.md` (add a "Re-run after fixes" section)

**Acceptance Criteria:**
- [ ] A fresh `work/` root is built with `savant backfill --start 2025-01-01 --end <yesterday> --workers 5`. The doc records the runtime and size.
- [ ] Bus is present from 2025-07-30. Red/Orange cars average more than 1 car per segment (B1 and B2 fixed).
- [ ] No Red car numbers appear in mattapan, and no non-roster car has a percentile
- [ ] At least one qualified Red or Orange car has a negative TTOE. The Red fleet medians for Speed vs Expected are listed, along with whether CRRC leads.
- [ ] The build's peak RSS (`/usr/bin/time -l`) is recorded and is under 7 GB
- [ ] The 3-car dashboard comparison still matches within ±5%

**Verify:** the doc section exists with every item filled in from real output

```json:metadata
{"files": ["docs/sanity-check-2026-11.md"], "verifyCommand": "grep -q 'Re-run after fixes' docs/sanity-check-2026-11.md", "acceptanceCriteria": ["LAMP backfill runtime/size", "bus present from 2025-07-30, multi-car consists", "no mattapan leak, no non-roster pct", "negative TTOE exists; speed-vs-expected fleet medians", "build peak RSS < 7GB", "dashboard comparison within 5%"], "modelTier": "frontier"}
```

## After this plan

Mockups for Home, Leaderboard, Car page and Fleet vs Fleet go to the user for approval. A second plan then builds the real frontend: the line map, Savant-style percentile bars, and path routing with an SPA fallback.
