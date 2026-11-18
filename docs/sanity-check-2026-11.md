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
