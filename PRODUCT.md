# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Transit fans and MBTA riders browsing for fun: looking up "their" train car or bus, comparing fleets, arguing about which cars are best. Secondary: TransitMatters volunteers and local transit press who enjoy a shareable stat.

## Product Purpose
MBTA Savant treats every MBTA rail car and bus as a "player" and gives it a Baseball-Savant-style profile: a bio card, percentile rankings against its peers, season stats, and a game log, plus line leaderboards and fleet-vs-fleet comparisons. It is just for fun; the newer fleets (CRRC, Type 9, battery buses) should visibly come out ahead because the data shows it, not because anything is tilted. Success = people share car pages.

## Positioning
The only place that ranks individual MBTA vehicles from real arrival/departure data (every car in every consist), updated nightly. The Data Dashboard covers lines and stations; Savant covers the vehicles.

## Operating Context
Static site at savant.labs.transitmatters.org, rebuilt nightly from TransitMatters' LAMP event data. Stats are per ranking group: Red, Orange, Blue, Green (branches pooled), Mattapan (shown, never ranked), Bus (incl. Silver Line). Windows: calendar-year seasons plus "last 30 days". Commuter Rail is a later version.

## Capabilities and Constraints
- Per car: Trip Time Over Expected (headline; shown vs the line's average car), Speed vs Expected (vs average), On-Time %, Steadiness, Door Time, Games Played, Iron Horse streak, Miles Logged (rail), Crowd Load (newer rail only, unranked), Top Speed (fun fact, unranked), Usual Teammates (rail), Routes run (bus), game log.
- Percentiles 0–100 within the group among qualified, roster-listed cars; married pairs share stats.
- Bio: builder, model, years, propulsion, length, garage (bus) from the unofficial MBTA Vehicle Inventory.
- Data is static JSON under /data; no backend. Must stay near-zero hosting cost.
- Stack: React + TypeScript + Vite (web/), existing.

## Brand Commitments
- Name on the page: **MBTA Savant**. A small "a TransitMatters Labs project" mark in header and footer (user decision 2026-11-18).
- Visual reference explicitly requested by the user: look like Baseball Savant (baseballsavant.mlb.com) — player-page percentile rankings with red/blue bubbles, leaderboards, search, bio card. Must not use MLB or Baseball Savant logos, names, or trademarks.
- Copy must say it is a fan site, not an official MBTA assessment, and credit the vehicle inventory source.

## Evidence on Hand
Real published data in out/data (built from work/v2: 2025–2026 seasons, ~200 Red cars, ~150 Orange, ~94 Blue, ~200 Green, ~1,000 buses). Sanity check: docs/sanity-check-2026-11.md. No vehicle photos exist; do not fabricate photos of specific cars.

## Product Principles
1. Every car is a player: the car page is the heart of the site.
2. Fun first, honest always: playful framing, real numbers, no tilting.
3. Compare within peers: percentiles are only against the same line/group.
4. No blame on people: cars are the players, never operators or crews.
