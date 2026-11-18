# Real-data sanity check (2026-11-17)

This is the first run of the pipeline on real S3 data (`tm-mbta-performance`, read-only). The bottom line:

- The segment logic is right. It matches the dashboard's v5 `travel_times` and `byVehicle` to the second.
- The `backfill` source is not usable for per-car stats. The monthly archives (`Events/monthly-data`, `Events/monthly-bus-data`) carry only the lead car's `vehicle_label` on rail and an empty `vehicle_label` on bus. They have no `vehicle_consist` and no occupancy. See Blocking findings.

Two data roots were built, both under the gitignored `work/`:

| Root | How | Covers |
|---|---|---|
| `work/` | `savant backfill --start 2025-01-01 --end 2026-11-16` (monthly archives, as specified) | 2025-01-01 to 2026-10-31. November 2026 has no archive yet. Also includes the 2026-11-16 orange smoke ingest. |
| `work/lamp/` | `savant ingest --date D` for each day (LAMP daily files), 5 workers | Partial: about 490 of 685 rail days and 290 bus days before the laptop went to sleep (see Run notes) |

## 1. Runtimes and sizes

| Step | Wall | CPU / memory | Output |
|---|---|---|---|
| Smoke: `ingest --date 2026-11-16 --groups orange` | 1.2 s | | 8,610 segments, 454 trips, 110 cars, 6 cars per segment |
| One month: `backfill 2026-10-01..2026-10-31`, all groups | 60 s | | 33 MB. red 200,506, orange 218,274, blue 120,691, green 583,596, mattapan 50,368, bus 1,917,833 segments |
| Full archive backfill: `backfill 2025-01-01..2026-11-16`, all groups | 2,617 s (43.6 min)\* | | `du -sh work/segments` = **740 MB**: bus 465, green 144, red 44, orange 43, blue 28, mattapan 16. 669 days per group (mattapan 657). |
| LAMP `ingest`, one day, all groups | 13 s | | about 1.1 MB per day |
| `build` on the archive root | 988 s\* | 222 s user CPU, **10.1 GB peak RSS** | 1,796 JSON files, 25 MB. No bus output (see B2). |
| `build` on the partial LAMP root | **78 s** | 250 s user CPU, **11.4 GB peak RSS** | 4,149 JSON files, 65 MB |

\* These wall times include laptop sleep (lid closed on battery from about 17:43; see Run notes). At the measured October rate of 60 s per month, the full archive backfill should take about 23 minutes standalone.

Projections:

- **LAMP-based backfill of the full range:** about 2.5 h serial (685 days × 13 s), or about 35 min with 5 workers.
- **LAMP segment size for the full range:** about 760 MB. Rail would be about 300 MB. Bus would be about 460 MB, since bus LAMP only exists from 2025-07-30.
- **Build time:** comfortably under the 30-minute Actions limit. It was 78 s wall and about 4 min of CPU on roughly 70% of the data.
- **Build memory is the risk.** Peak was 11.4 GB on partial data and will be higher on the full range. GitHub's standard Linux runner has 16 GB on public repos and 7 GB on private ones. The deferred `SELECT *` item in `stats.py` (the window functions materialise every column twice) should be done before the nightly job runs on the full history. The bus year windows dominate. It did not OOM here (48 GB machine).

## 2. Dashboard comparisons (bar: ±5%)

Day: **2026-10-15**.

- **Our side:** read our LAMP-ingested segments for trips whose `cars` include the car. For each trip, sum `travel_sec` along the chain from A to B, plus `dwell_sec` at each intermediate stop. Take the median.
- **Dashboard side:** v5 branch, `server/chalicelib/s3_historical.travel_times(stops_a, stops_b, d, d, single_day=True)` run unmodified in a temporary worktree. Then apply `byVehicle.ts`: median of `travel_time_sec` per `vehicle_label`. The `vehicle_label` is the lead car.

| Car | Pair | Ours | Dashboard (label) | Diff |
|---|---|---|---|---|
| Orange CRRC **1430** | Malden Center 70034 → Assembly 70278 (2 segments, via Wellington) | n=14, median **230.5 s** | label 1404 (1430's consist lead): n=14, **230.5 s** | **0.0% PASS** |
| Red Bombardier **1869** | Harvard 70067 → Kendall 70071 (2 segments, via Central) | n=13, **301.0 s** | label 1869: n=13, **301.0 s** | **0.0% PASS** |
| Bus **1263**, route 28 inbound | Morton St 28-1-1731 → Franklin Park 28-1-383 (2 segments) | n=12, **466.5 s** | label 1263: n=12, **466.5 s** | **0.0% PASS** |

Every individual trip value matched too, including a 929 s Red outlier.

Notes:

- The dashboard's "By vehicle" chart only shows lead cars. Car 1430 never appears there under its own number, but Savant credits it with every trip of the 1404 consist. That is the point of using `vehicle_consist`.
- The same comparison on **archive-derived** segments (`work/`):
  - Red 1869 still matches (it was the lead car).
  - Orange 1430 has **no segments at all**, because it is not a lead car.
  - Bus 1263 has **no segments at all**, because the bus archive has no vehicle.

## 3. Rankings: top and bottom 5 by TTOE percentile, October 2026

October 2026 is complete in both sources. These rows come from `stats.car_stats` plus `publish.add_percentiles` for the window 2026-10-01..2026-10-31. Lower TTOE is better.

### From LAMP (the trustworthy one)

**Red:** 204 cars, 196 qualified, 0 unknown fleet.

| | Car | Fleet | Pct | TTOE |
|---|---|---|---|---|
| Top | 1820 / 1821 | #3 Bombardier | 99 | +5.89 s |
| | 1854 / 1855 | #3 Bombardier | 98 | +5.99 s |
| | 1928 | #4 CRRC | 97 | +6.26 s |
| Bottom | 1515 | #1 (1500s) | 2 | +10.85 s |
| | 1861 / 1860 | #3 Bombardier | 2 / 1 | +11.82 / +11.89 s |
| | 1714 / 1715 | #2 UTDC | 0 | +15.14 s |

**Red fleet medians (TTOE):**

| Fleet | Qualified cars | TTOE | On-time | Steadiness | Games played |
|---|---|---|---|---|---|
| #4 CRRC | 66 | **+7.17 s** | 89.1% | 4 s | 87% |
| #3 Bombardier | 72 | +7.86 s | 89.0% | 6 s | 76% |
| #2 UTDC | 46 | +8.25 s | | 9 s | |
| #1 1600s | 2 | +8.11 s | | | |
| #1 1500s | 10 | +8.75 s | | 10 s | |

**New fleets lead, as expected.** CRRC is best on TTOE, steadiness and games played, and the Pullman 1500s are worst. The spread is small, though: about 1.6 s per segment.

**Orange:** 138 cars, all qualified, all `Orange Line #14 (CRRC)`.

- **Top:** 1528 / 1529 (pct 99, +1.74 s), 1530 / 1531 (98, +1.96 s), 1504 (96, +2.06 s).
- **Bottom:** 1411 (3, +3.39 s), 1542 / 1543 (1, +3.53 s), 1512 / 1513 (0, +3.88 s).
- **Fleet median:** TTOE +2.60 s, on-time 94.4%, top speed 49.6 mph, crowd load 11.5%.
- There is only one fleet on Orange, so "new fleet leads" can't be tested there.

### From the archive (`work/`, same window), for contrast

- **Red:** only 147 cars (95 qualified). The top 5 is 1825, 1956, 1813, 1827, 1930. The bottom 5 is 1910, 1716, 1822, 1804, 1861.
- **Orange:** only 66 cars (60 qualified).

Only lead cars exist in this data, so the orders differ from LAMP and trip counts are roughly halved. This is exactly the B1 problem.

## Archive partitioning (open question from Task 7)

Monthly archives are **partitioned by service_date**. I checked `Events/monthly-data/70061/Year=2026/Month=9` and `Month=10`:

- Every row's `service_date` is inside the file's month. No adjacent-month service dates appear.
- The last service day's after-midnight events are present in that file. Sep-30 events run to 2026-10-01 01:16:53 (14 rows). Oct-31 events run to 2026-11-01 01:56:28 (17 rows).

So `cmd_backfill`'s month-by-service-date mapping is correct.

Two more points on DST:

- Archive event times have no UTC offset.
- There were no DST artifacts in the Red segments on 2025-11-01 (fall back) or 2025-03-08/09 (spring forward): no segments over 30 minutes and no negative times.

## Blocking findings (real-data pipeline bugs, not patched)

**B1. Monthly rail archives have no consist.**

- **Input:** `Events/monthly-data/<stop>/Year=2026/Month=10/events.csv.gz`. The columns are `service_date, route_id, trip_id, direction_id, stop_id, stop_sequence, vehicle_id, vehicle_label, event_type, event_time, arrival_time, scheduled_headway, scheduled_trip_id, trip_id_gtfs, scheduled_tt`. There is no `vehicle_consist` and no occupancy, and `vehicle_label` is the single lead car (for example `1920`).
- **Expected:** each segment credits all 4 to 6 cars, as LAMP does.
- **Actual:** in October 2026 backfill segments, `len(cars)` averages 1.00 on red, orange, blue and mattapan (green 1.97, from dashed labels). `occupancy_pct` is empty on 100% of segments. Non-lead cars get no data for any backfilled period.

**B2. Monthly bus archives have no vehicle at all.**

- **Input:** `Events/monthly-bus-data/1-0-110/Year=2026/Month=10/events.csv.gz`. Both `vehicle_id` and `vehicle_label` are empty (the stop_id is also bare, `110`).
- **Actual:** all 1,917,833 October bus segments have `cars = []`. The archive build publishes **no bus group at all** for 2025 and 2026.

**B3. Benchmark coverage is poor in the archives.**

- Only 12% of rows in the Orange `70019` Oct-2026 archive have `scheduled_tt`. Segment `benchmark_sec` coverage is orange 17%, red 41%, green 91%, blue 99.6%, bus 86%.
- In LAMP, coverage is 100% (orange 2026-11-16).

**Suggested direction, for review rather than implementation:** backfill from LAMP daily files instead of the monthly archives.

- `Events-lamp/daily-data` exists back to 2019. It has `vehicle_consist`, and in 2025 its consists are present but occupancy is blank.
- Bus LAMP starts 2025-07-30. There is no source of bus vehicle numbers before then in these prefixes (Gobble `Events-live` not checked), so bus 2025 would effectively be August to December.
- The cost is about 13 s per day, versus 60 s per month for the archive.

## Other findings

- **TTOE is outlier-driven and always positive.** TTOE is `avg(travel - median expected)`. Across all Red segments in October the mean delta is +7.7 s, the median delta is 0 s, p99 is 188 s, and the max is 11,465 s (a 3.2 h segment). Zero qualified red or orange cars have a negative TTOE, so every car reads as "slower than expected." A few disruption trips can decide a car's rank. Consider using a median, or a capped or trimmed mean.
- **Benchmarks only come in whole minutes.** `scheduled_tt` is in 60 s steps (orange 2026-11-16: 60 / 120 / 180 only), so short segments are almost always "on time." Fleet on-time rates come out at 85 to 95% with little spread.
- **Top speed is about the route, not the car.** The Red fleet medians for top speed are all 48.3 mph. The 90th percentile is set by the same long segments for every car, so it doesn't separate fleets.
- **Married pairs tie.** Married pairs always share identical stats (1820 / 1821, 1528 / 1529 and so on), so leaderboards will show cars in pairs.
- **Unknown fleet.**
  - **Revenue cars:** none on red, orange or blue (LAMP).
  - **Bus:** 6 of 969 (0950 to 0958 and `0952`, missing from the roster; also note the leading zeros).
  - **Green:** 15 to 37 per year. Most are labels outside the real fleet (3000 to 3599, 2058, `363635`, `7`, `8000`, `None`). Two of these (3000, 3201) **qualified and were ranked** in the archive 2026 window.
  - **Work equipment** (WORK, WIRE, ETTI, TLTY, RADL, SPOT, RAIL, RIME, OTO1) shows up as "cars" in archive data.
  - **Suggestion:** rank only cars that are in the roster.
- **Red cars appear in the mattapan group.** `stations.json` Mattapan/Ashmont includes the Red platforms 70093/70094, so 9 Red `70094→70094` segments put 18 to 29 Red car numbers into the Mattapan 2025/2026 output as "Unknown fleet." Ingest for each group should filter on `group_for_route(route_id)`.
- **Occupancy coverage (LAMP, October 2026).** Red: 66 of 204 cars, CRRC #4 only (older fleets don't report). Orange: 130 of 138. Bus: none (not published). 2025 LAMP has no occupancy at all.
- **Trip mix.** NONREV trips are 1.9% of Red segments and 0.7% of Orange segments, and they are included. ADDED trips are 7 to 17%.
- **No retries on S3 reads.** One `Connection broken` (urllib3 ProtocolError) while reading an S3 body aborts the whole `ingest`. Groups after the failing one are not written for that day. The nightly job should retry reads.
- **Archives lag.** November 2026 has no monthly archive yet, so the archive root's `last30` window (2026-10-18..11-16) really holds only about 14 days.

## Run notes

- **Credentials.** The default AWS credentials use the `aws login` provider, which needs `botocore[crt]`, and the pipeline does not depend on that. I ran with `uv run --with 'botocore[crt]'`, which is ephemeral and leaves no project change. Worth adding to the pipeline's dependencies, or using a profile, for local runs.
- **Laptop sleep.** From about 17:43 the laptop was closed on battery and mostly asleep, with short DarkWakes (pmset log). That caused stalled S3 reads, `RequestTimeTooSkewed` errors and inflated wall times. The LAMP ingest was stopped part way for that reason, and these are not pipeline hangs.

## Re-run after fixes

Run on 2026-11-17/18, after Tasks 11 to 14 (LAMP backfill with retries, group route filter, roster-only ranking, TTOE capped at 5 min per segment, Speed vs Expected, DuckDB memory limit). Fresh data root `work/v2`, output to `out/`. Both commands ran under `caffeinate -is`, and the laptop did not sleep.

### Acceptance criteria

| AC | Result | Evidence |
|---|---|---|
| Fresh LAMP backfill; runtime and size recorded | **PASS** | `backfill --start 2025-01-01 --end 2026-11-16 --workers 5 --root ../work/v2`: **2,728 s (45.5 min)** wall, 2,554 s user, 1.52 GB peak RSS. Exit 0 on the first try, with no failed days and no re-run needed. `du -sh work/v2/segments` = **669 MB**: bus 379, green 147, orange 49, red 48, blue 31, mattapan 16. |
| Bus present from 2025-07-30 | **PASS** | The first bus service date is 2025-07-30 (63,372 segments). There are 475 bus day files, 2025-07-30 to 2026-11-16, and 29.2 M segments. The 210 earlier days produced 0 segments, so no file was written. |
| Red and Orange average more than 1 car per segment (B1 and B2 fixed) | **PASS** | Mean `len(cars)` per segment: red **5.88**, orange **5.97**, blue 5.97, green **1.95**. The median is 6 for red and orange, and 2 for green, and both years look the same. Mattapan and bus are 1.0. Every bus segment has a vehicle. |
| No Red car numbers in mattapan | **PASS** | Mattapan has 7 cars in 2025 and 2026 (3087, 3234, 3238, 3260, 3263, 3265, 3268) and 6 in last30. The overlap with Red numbers is empty in every window. |
| No non-roster car has a percentile | **PASS** | In every group and window, every car with `ranked=false` has all-null `pct`. The counts are in the table below. |
| A qualified Red or Orange car has negative TTOE | **PASS, but only just** | Only **2025 Orange** has any: 6 qualified cars, 1450/1451 at −0.36 s, 1544/1545 at −0.32 s, 1426 / 1427 at −0.28 s. **2026 and last30 have no Red or Orange car below zero. Red has none in any window.** See "TTOE is still always positive" below. |
| Red fleet medians of Speed vs Expected; does CRRC lead? | **PASS, and CRRC leads** | See the fleet table. CRRC is best on both TTOE and Speed vs Expected in 2026 and last30. In 2025, Bombardier edges CRRC on Speed vs Expected (−7.64% vs −7.74%), but CRRC still leads TTOE. |
| Build peak RSS under 7 GB | **PASS** | `build --root ../work/v2 --out ../out`: **35.2 s** wall, 157.6 s user. `maximum resident set size` = **5,652,070,400 bytes (5.65 GB, 5.26 GiB)**, down from 11.4 GB on 70% of the data. 5,201 JSON files, 89 MB. |
| 3-car dashboard comparison within ±5% | **PASS (0.0%)** | See below. |

### Ranked and unranked cars per group

Each cell is ranked (qualified) / unranked (qualified). Unranked cars with a non-null pct: **0 everywhere**.

| Group | 2025 | 2026 | last30 | Unranked numbers |
|---|---|---|---|---|
| red | 248 (238) / 0 | 230 (218) / 0 | 204 (200) / 0 | |
| orange | 146 (144) / 1 (0) | 152 (146) / 0 | 138 (138) / 0 | `0441` (1 trip, 2025) |
| blue | 94 (94) / 0 | 94 (94) / 0 | 92 (92) / 0 | |
| green | 199 (185) / 38 (5) | 202 (171) / 18 (2) | 168 (160) / 3 (0) | 2058, 2062, 3000, 3002, 3008, 3201, 3571, `363635` … |
| bus | 1026 (1011) / 4 (4) | 1090 (1086) / 6 (6) | 968 (949) / 6 (6) | 950, 951, 957, 958, `0952`, `0953` |
| mattapan | 0 / 7 (7) | 0 / 7 (6) | 0 / 6 (6) | unranked by design |

Work equipment (WORK, WIRE, ETTI and so on) no longer appears in any group.

### Dashboard comparison (redone on `work/v2`)

The method is the same as section 2: day 2026-10-15, raw (uncapped) `travel_sec` along the chain, plus `dwell_sec` at the intermediate stop, median over the car's trips. The dashboard values are the v5 numbers recorded in section 2; the dashboard code was not re-run. Bus segment stop ids are the bare LAMP `stop_id` (`1731`, `383`), not the dashboard's `28-1-1731` key. This is unchanged from the first run.

| Car | Pair (via) | Ours (`work/v2`) | Dashboard | Diff |
|---|---|---|---|---|
| Orange 1430 | 70034 → 70278 (70032) | n=14, **230.5 s** | n=14, 230.5 s | **0.0%** |
| Red 1869 | 70067 → 70071 (70069) | n=13, **301.0 s** (includes the 929 s outlier) | n=13, 301.0 s | **0.0%** |
| Bus 1263, route 28 | 1731 → 383 (1737) | n=12, **466.5 s** | n=12, 466.5 s | **0.0%** |

### Red fleet medians (qualified, ranked)

| Window | Fleet | Cars | TTOE | Speed vs Expected | On-time | Steadiness | Games played |
|---|---|---|---|---|---|---|---|
| 2026 | **#4 CRRC** | 66 | **+7.20 s** | **−6.62%** | 89.3% | 5 s | 72.8% |
| 2026 | #3 Bombardier | 82 | +8.22 s | −7.56% | 88.8% | 6 s | 66.9% |
| 2026 | #2 UTDC | 50 | +9.47 s | −8.51% | 87.0% | 11 s | 52.5% |
| 2026 | #1 1500s | 16 | +9.66 s | −8.62% | 86.3% | 11 s | 40.5% |
| 2026 | #1 1600s | 4 | +10.81 s | −9.30% | 86.2% | 11 s | 41.7% |
| last30 | **#4 CRRC** | 66 | **+5.32 s** | **−5.16%** | 89.6% | 4 s | 66.7% |
| last30 | #3 Bombardier | 74 | +7.26 s | −6.78% | 88.1% | 6.5 s | 73.3% |
| last30 | #1 1600s | 2 | +7.84 s | −7.05% | 86.0% | 10 s | 63.3% |
| last30 | #1 1500s | 8 | +7.94 s | −6.81% | 85.9% | 10.5 s | 46.7% |
| last30 | #2 UTDC | 50 | +8.71 s | −8.08% | 85.9% | 10 s | 63.3% |
| 2025 | #4 CRRC | 50 | **+8.00 s** | −7.74% | 88.7% | 6 s | 47.3% |
| 2025 | #3 Bombardier | 82 | +8.51 s | **−7.64%** | 87.6% | 7 s | 74.0% |

In 2025, the 1500s, 1600s and UTDC came in at +9.6 to +10.7 s TTOE and −8.5 to −9.6% Speed vs Expected.

### Top and bottom 5 by TTOE percentile, 2026

Each entry is car (pct, TTOE, Speed vs Expected, trips).

- **Red top:** 1902 / 1903 (100, +5.45 s, −5.05%, 3,684), 1964 / 1965 (99, +5.65 s, −5.33%), 1966 (98, +5.88 s). All are CRRC.
- **Red bottom:** 1509 (2, +12.18 s), 1616 / 1617 (1, +12.98 s), 1518 / 1519 (0, +14.16 s, −11.0%, **52 trips**, so they barely qualified).
- **Orange top:** 1550 / 1551 (99, +2.56 s, −4.42%), 1482 / 1483 (98, +2.57 s), 1512 (97, +2.65 s).
- **Orange bottom:** 1487 (3, +3.93 s), 1426 / 1427 (1, +4.28 s), 1533 / 1532 (1 / 0, +4.47 s, −7.43%).
- **last30 Red:** the top 5 are all CRRC (1964 / 1965 at +4.37 s). The bottom 5 are all UTDC (1746 / 1747 at +20.78 s, −15.27%, 82 trips).
- **Bus, 2026, best TTOE:** 1973 (XDE40 hybrid, −5.75 s, +2.23%, 278 trips), 0779 (−1.42 s), 0807 (−0.45 s), 0872 (−0.38 s), 0900 (−0.15 s). The last four are 2008 D40LF diesels.
- **Bus, 2026, worst TTOE:** 1428 (+32.88 s, 88 trips), 0842 (+24.98 s), 0840, 3345, 1734.
- **Bus percentiles:** with n = 1,086, several cars round to pct 100 (for example 0869 at +0.26 s), so pct 100 is not unique.

**Speed vs Expected spread, 2026, qualified ranked cars:**

| Group | Median | Min | Max |
|---|---|---|---|
| Red | −7.48% | −11.0% | −5.05% |
| Orange | −6.10% | −7.43% | −4.42% |
| Blue | −7.97% | −8.59% | −7.41% |
| Green | −6.68% | −23.51% | −4.04% |
| Bus | −3.20% | −8.47% | +2.23% |

On rail, the Speed vs Expected order is nearly the same as the TTOE order, so the two metrics mostly duplicate each other.

### Surprises and concerns

1. **TTOE is still always positive on rail, and Speed vs Expected is always negative.**
   - This is structural, not a code bug.
   - Over all Red 2026 segments, the median delta (travel − expected) is **0 s**. 44.9% of segments are faster than expected, 11.3% are equal and 43.8% are slower.
   - But the raw mean is +9.39 s and the capped mean is still **+8.04 s**. Only 0.6% of segments exceed the 300 s cap, and p99 is 222 s.
   - The cause is the shape of the distribution. A train can only be a few seconds faster than the median, but it can be up to 300 s slower. So any mean of capped deltas lands well above zero, and every car reads as "slower than expected."
   - The cap fixed rank stability (no single 3-hour segment decides a rank), but not the sign.
   - The "negative TTOE exists" AC passes only through six 2025 Orange cars at about −0.3 s.
   - If the site should show some cars as faster than expected, the expected value needs to be a mean (or the capped mean of the cell), or TTOE needs to be centred on the fleet. This is a product decision for review.
2. **Silently dropped bus routes.** On 2026-10-15, LAMP bus events at our stops carried 150 route_ids. Two are not mapped by `group_for_route`, and their segments are dropped:
   - **`34E`**: 2,160 events
   - **`708`**: 657 events
   - Together that is 2,817 of 156,540 events (1.8%).
   - v2 bus segments for that day are 69,167, against 70,508 in the first LAMP run.
   - This only counts routes that serve stops listed in `bus_constants`. A route with no such stops is never downloaded at all, so it can't be counted here.
3. **`publish` does not clear old output.** 26 stale files from the first (archive) build are still in `out/data`. Examples: `2026/cars/blue/WORK.json`, `RIME.json`, `2026/cars/orange/0518.json`, `2025/cars/red/1946.json`. They are not in any group or index file, but a deploy that copies `out/` wholesale would publish them. Cleaning `out/` before a build, or having `publish` write to a fresh directory, would fix it.
4. **Bus numbers mix zero-padded and bare forms.** 148 of 1,096 2026 bus numbers are zero-padded (`0779`, `0952`), while others are bare (`950`). No integer id appears twice, so no bus is split today. But `0952`/`0953` and `950`/`951` show the feed is inconsistent, and URLs will carry the leading zeros.
5. **Low-trip qualifiers anchor the bottom.** Red 1518 / 1519 (52 trips) and last30 UTDC 1746 / 1747 (82 trips) are the extremes. With a 50-trip minimum, the tails are noisy.
6. **Occupancy is sparse.** Only 1.4% of Red segments and 3.9% of Orange segments have any non-null occupancy across the full range (none in 2025). Blue, green and bus have none.
7. **Benchmark coverage is fixed.** `benchmark_sec` is non-null on red 97.6%, orange 97.2%, blue 97.5%, green 89.2%, mattapan 98.9% and bus 98.9% of segments. The archive run had orange at 17% and red at 41%.
