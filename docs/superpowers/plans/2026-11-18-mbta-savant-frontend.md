# MBTA Savant Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development to implement this plan task-by-task.

**Goal:** Replace the placeholder UI in `web/` with the approved Baseball-Savant-style site: car pages, glossary, line leaderboards, home with search.

**Architecture:** A static React 19 + TypeScript + Vite SPA that reads `/data/...` JSON (published by `pipeline/savant/publish.py`). TanStack Router handles file-based, type-safe path routes, and TanStack Query handles data fetching and caching. Both match the TransitMatters Data Dashboard's stack. Styling is Tailwind CSS v4, with the design tokens defined in `@theme`. CloudFront already maps 403/404 to `/index.html`, and Vite's dev server falls back to index.html. The visual system is ported from the approved mockups.

**Tech Stack:** React 19, TypeScript, Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`), `@tanstack/react-router` with `@tanstack/router-plugin` (file-based routes), `@tanstack/react-query`, Roboto Condensed from Google Fonts, Vitest plus Testing Library for helpers and components. User decision 2026-11-18: "make it react, tailwind, etc".

**Spec:** `docs/superpowers/specs/2026-11-17-mbta-savant-design.md`. Product: `PRODUCT.md`. **Approved design (binding):** `docs/design/mockups/car_template.html`, `docs/design/mockups/glossary.html` and `docs/design/mockups/car-page-approved.png`. `docs/design/mockups/build_car.py` shows how the mockup reads data.

## Global Constraints

- **Look matches the approved mockups:**
  - tokens: `--ink #1d2427`, `--ink-2 #4d5a5f`, `--ink-3 #6f7c81`, `--brand #2c6e7c`, `--brand-2 #5d929d`, `--rule #6f9ca6`, `--panel-line #cbdadd`, `--track #dde7ea`, `--wash #f2f6f7`, `--radius 8px`
  - percentile scale: blue `rgb(50,96,180)` → gray `rgb(200,200,200)` → red `rgb(214,41,41)`
  - line colors: Red `#da291c`, Orange `#ed8b00`, Blue `#003da5`, Green `#00843d`, Mattapan `#7a8b8f`, Bus `#ffc72c`
  - Roboto Condensed with tabular numerals
  - 1px borders, rounded panels with a soft shadow, tinted bar fills with a saturated bubble, pill tabs
- **Stat names and display (user-approved 2026-11-18):**
  - **Time Saved** = −`ttoe_vs_avg_sec`, shown "+2.9 s", ranked by pct `ttoe_sec`.
  - **Pace+** = round(100 + `speed_vs_avg_pct`), ranked by pct `speed_vs_expected_pct`.
  - **On-Schedule %** = `on_time_pct`.
  - **Consistency** = `steadiness_sec` "6 s".
  - **Door Time** = `door_time_sec`, shown "2 s quick" / "2 s slow" / "typical".
  - **Days in Service** = `games_played_pct`.
  - **Iron Horse Streak** = `iron_horse_days`.
  - **Miles Logged** = `miles`.
  - Fun facts, unranked: **Cruise Speed** = `top_speed_mph`, **Avg Crowding** = `crowd_load_pct`, **Coupled With** = `teammates`, **Routes Run** = `routes` (bus).
  - Sections are "Performance" and "Workload".
  - Glossary text is the single source in one module (`web/src/glossary.ts`), used by both the tooltips and the Glossary page. The copy is verbatim from the mockup.
- **Branding:**
  - "MBTA savant" wordmark plus the wheel emblem from the mockup
  - "a TransitMatters Labs project" in the header
  - footer reads "A TransitMatters Labs fan site, not an official MBTA assessment…" and "Vehicle data: The MBTA Vehicle Inventory Page (unofficial)"
  - no MLB or Baseball Savant names or logos.
- **Routes:**
  - `/` is home
  - `/line/:group` is the line leaderboard
  - `/car/:group/:number` is the car page
  - `/glossary` is the glossary
  - `?season=2026|2025|last30` is optional. The default season is the newest season with at least one qualified ranked car in the group, else `last30`.
- **Data access:**
  - only `/data/meta.json`, `/data/{window}/index.json`, `/data/{window}/groups/{group}.json`, `/data/{window}/cars/{group}/{number}.json` and `/data/fleets/{group}.json`
  - a missing file or an HTML fallback (non-JSON content-type) means "no data", never a crash.
- **Dependencies (user-approved stack):**
  - runtime: `@tanstack/react-router`, `@tanstack/react-query`
  - dev: `tailwindcss`, `@tailwindcss/vite`, `@tanstack/router-plugin`, `vitest`, `@testing-library/react`, `jsdom`, `prettier-plugin-tailwindcss`
  - nothing else without a reason in the report.
- **Styling rules:**
  - Tailwind utilities, with the tokens as theme variables (`--color-ink`, `--color-brand`, `--color-panel-line`, `--color-track`, `--color-wash`, `--color-poor`, `--color-great`, line colors as `--color-line-red` and so on, `--radius-panel`, `--font-sans` set to Roboto Condensed).
  - A small `@layer components` is allowed only for genuinely repeated composites (`.panel`, the percentile bar).
  - Dynamic colors (percentile, line) use inline style or CSS variables, never generated class names.
- **Node ≥ 22.12**: use `~/.nvm/versions/node/*` or mise, since the default node 22.0 is too old.
- **Commits** end with a `Co-Authored-By` trailer for the model.
- **Verify by build plus headless Chrome screenshots** at 1440 and 520 widths: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --screenshot=... --window-size=W,H http://localhost:5173/...` while `npm run dev` runs.
- **Accessibility:** visible focus rings; tooltips work on focus as well as hover; every bar has an aria-label; color is never the only signal (the values are printed).

**User decisions (already made):**
- "make it look like baseball savant"
- "each car should have its own page with percentiles, stats, etc"
- the stat renames and the glossary
- "it feels a little blocky", which led to the softened styling in the approved mockup
- "build it" (2026-11-18): approves the mockups. Pace+ and ranked Door Time stand as mocked.

## Review Focus

1. **A car with no data for the selected season** (for example 2025 for a car new in 2026) shows a season toggle without that season, or an explicit empty state. It never crashes. Test: `routes.test.ts` and `format.test.ts` helpers, plus a screenshot of a car page whose 2025 file is missing.
2. **Unqualified or unranked cars** (green 3000, every Mattapan car) render stats without bubbles and say why.
3. **Unknown routes or numbers** (`/car/red/9999`, `/line/purple`) show a friendly not-found page with search.
4. **Bus pages:** no married pair, bus-shaped hero art, Routes Run shown, no Miles or Cruise Speed rows (they are null).
5. **Mobile at 520 px:** no horizontal scroll, and panels stack.

---

### Task F1: App shell, tokens, router, data layer, search

**Goal:** Masthead, nav, footer, routing, a typed data layer and car-number search, all in the approved style.

**Files:**
- Create: `web/src/index.css` (Tailwind import plus `@theme` tokens, plus base styles for selection, scrollbars and focus rings), `web/src/routes/__root.tsx` (layout: Masthead, Outlet, Footer), `web/src/routes/index.tsx`, `web/src/routes/line.$group.tsx`, `web/src/routes/car.$group.$number.tsx`, `web/src/routes/glossary.tsx` (placeholders until F2/F3), `web/src/queries.ts` (TanStack Query hooks), `web/src/format.ts`, `web/src/format.test.ts`, `web/src/glossary.ts`, `web/src/components/Masthead.tsx`, `web/src/components/Footer.tsx`, `web/src/components/Search.tsx`, `web/src/components/Emblem.tsx`
- Modify: `web/src/api.ts` (types for the centered fields and averages; `getJson` keeps its non-JSON → null behaviour), `web/src/main.tsx` (RouterProvider and QueryClientProvider), `web/vite.config.ts` (tanstackRouter plugin, then react, then tailwindcss), `web/index.html` (font links), `web/package.json` (dependencies plus a `test` script)
- Delete: `web/src/App.tsx`
- Delete: `web/src/Leaderboard.tsx` and `web/src/CarPage.tsx` once their replacements land (F2 and F3). Until then, App can render a placeholder for those routes.

**Interfaces:**
- **Routes:** TanStack file routes. Search params are validated with `validateSearch` to `{ season?: '2026' | '2025' | 'last30' | string }`. `group` params are validated against GROUPS, and an unknown group throws `notFound()`. The root route's `notFoundComponent` is the NotFound page.
- **`queries.ts`:** `useMeta()`, `useIndex(window)`, `useGroup(window, group)`, `useCar(window, group, number)`, `useFleets(group)`, all with `staleTime` of 1 hour. A missing file resolves to `null`, not an error.
- `format.ts`:
  - `pctColor(p:number): string` (the mockup's function)
  - `signed(v, digits, unit)`, using U+2212 for minus and never showing "−0.0"
  - `timeSaved(car)`, `pacePlus(car)`, `doorLabel(sec)`
  - `GROUPS` metadata: name and color per group
- `glossary.ts`: `GLOSSARY: Record<StatId,{name, short, better:'higher'|'lower'|'none', calc, example?}>`, with the mockup's copy, plus the "How rankings work" paragraphs.
- Search: type a number to get matches from `/data/{default window}/index.json` across groups (for example "1400" gives Orange 1400 and Bus 1400), showing the group dot and fleet label. Enter opens the first match. Keyboard: arrows, Enter, Esc.

**Acceptance Criteria:**
- [ ] `npm test` passes: `signed(-0.04,1)` gives "0.0", `pacePlus` of speed_vs_avg 2.5 gives 103, `doorLabel(-2)` gives "2 s quick", and `pctColor(0/50/100)` gives the three anchor colors
- [ ] `/line/purple` renders the NotFound component
- [ ] The masthead, nav and footer match the mockup (screenshot)
- [ ] Searching "1400" lists Orange 1400 and Bus 1400

**Verify:** `cd web && npm test && npx tsc --noEmit && npm run build`

```json:metadata
{"files": ["web/src/index.css", "web/src/routes/__root.tsx", "web/src/queries.ts", "web/src/format.ts", "web/src/glossary.ts", "web/src/components/Masthead.tsx", "web/src/components/Search.tsx", "web/src/api.ts", "web/src/main.tsx", "web/vite.config.ts"], "verifyCommand": "cd web && npm test && npx tsc --noEmit && npm run build", "acceptanceCriteria": ["format unit tests", "unknown group notFound", "masthead matches mockup", "search finds cross-group numbers"], "modelTier": "standard"}
```

---

### Task F2: Car page

**Goal:** `/car/:group/:number` matches the approved mockup with real data.

**Files:**
- Create: `web/src/features/car/CarPage.tsx`, `web/src/features/car/BioPanel.tsx`, `web/src/features/car/PercentilePanel.tsx`, `web/src/features/car/CalendarPanel.tsx`, `web/src/features/car/GameLog.tsx`, `web/src/features/car/CarArt.tsx`, `web/src/components/StatTerm.tsx` (dotted-underline term with a tooltip and a glossary link), `web/src/components/SeasonToggle.tsx`, `web/src/components/PercentileBar.tsx`, all styled with Tailwind
- Modify: `web/src/routes/car.$group.$number.tsx` to render CarPage
- Delete: `web/src/CarPage.tsx`

**Interfaces:**
- **Data:** loads every available window for the car, for the season table and the toggle. Season state is in `?season=`.
- **BioPanel:** car art, number headshot, name and line, married pair (first teammate share ≥ 95%), the season table (Trips, Miles, Saved/stop, On-Sched, Iron Horse, plus a totals row) and Coupled With.
  - Bus: bus side-elevation art in the bus color, garage and propulsion in the bio, Routes Run instead of Coupled With.
- **PercentilePanel:** Performance and Workload sections, per the Global Constraints mapping, with fun facts and the "How these stats work →" link. Bars animate in once on load (ease-out) and respect reduced-motion.
- **CalendarPanel:** small-multiple months for a year window, a 5-week grid for last30, the month summary table (DAYS, TRIPS/DAY, SAVED/STOP) and the legend. Use `avg` from the group file's `averages.ttoe_sec`.
- **Tabs:** GAME LOG (default) and COUPLED WITH (full teammate list); for bus, ROUTES.

**Acceptance Criteria:**
- [ ] A side-by-side screenshot of `/car/red/1902` matches `car-page-approved.png`: layout, values (Time Saved +2.8 s or similar from current data, Pace+ 102 or 103) and styling
- [ ] `/car/bus/1263` renders bus art, the garage, Routes Run, and no Miles or Cruise Speed
- [ ] `/car/green/3000` (unranked) shows stats with no bubbles and the message "Not in the vehicle roster, so not ranked."
- [ ] `/car/mattapan/3087` shows "Mattapan cars aren't ranked."
- [ ] Screenshots at 520 px show no horizontal scroll
- [ ] tsc and build are clean

**Verify:** `cd web && npm test && npx tsc --noEmit && npm run build`, plus screenshots saved under `docs/design/screens/`

```json:metadata
{"files": ["web/src/features/CarPage.tsx", "web/src/features/car/BioPanel.tsx", "web/src/features/car/PercentilePanel.tsx", "web/src/features/car/CalendarPanel.tsx", "web/src/features/car/GameLog.tsx", "web/src/features/car/CarArt.tsx", "web/src/components/StatTerm.tsx", "web/src/components/SeasonToggle.tsx"], "verifyCommand": "cd web && npm test && npx tsc --noEmit && npm run build", "acceptanceCriteria": ["matches approved mockup", "bus variant", "unranked + mattapan messages", "mobile no h-scroll"], "modelTier": "frontier"}
```

---

### Task F3: Glossary, line leaderboard, home

**Goal:** The remaining pages, in the same system.

**Files:**
- Create: `web/src/features/glossary/GlossaryPage.tsx`, `web/src/features/line/LinePage.tsx`, `web/src/features/home/HomePage.tsx`, `web/src/components/NotFound.tsx`
- Modify: `web/src/routes/index.tsx`, `web/src/routes/line.$group.tsx`, `web/src/routes/glossary.tsx`, `web/src/routes/__root.tsx` (notFoundComponent)
- Delete: `web/src/Leaderboard.tsx`

**Interfaces:**
- **GlossaryPage:** matches `docs/design/mockups/glossary.html`, rendered from `glossary.ts`, with anchors per stat id (the StatTerm links resolve to them) and the sticky table of contents.
- **LinePage `/line/:group`:**
  - Savant-leaderboard style: a title like "2026 Red Line Leaderboard", the season toggle, and a sortable table with one row per ranked qualified car.
  - Columns: Rank, Car (link), Fleet, Trips, then each Performance and Workload stat, with the value cell tinted by its percentile (`color-mix` of `pctColor`, 35%) and the pct in small text.
  - The default sort is Time Saved, best first.
  - Below the table, a "Not ranked" section lists unqualified and unranked cars.
  - Above the table, a fleet strip from `fleets/{group}.json`: each fleet's median Time Saved and Pace+.
- **HomePage:**
  - a large search
  - a "Line Leaders" grid: one card per group with the top 5 by Time Saved, line-colored, linking to the car and the line
  - one sentence on what the site is
  - the latest service date.
- **NotFound:** a friendly message plus search.

**Acceptance Criteria:**
- [ ] `/glossary#pace-plus` scrolls to and highlights Pace+
- [ ] `/line/red` lists about 218 ranked cars, sorted by Time Saved, and clicking a header re-sorts
- [ ] `/` shows leaders for all six groups. Mattapan shows "Not ranked" with its cars listed.
- [ ] `/line/purple` and `/car/red/9999` show NotFound
- [ ] Screenshots at 1440 and 520 px
- [ ] tsc and build are clean

**Verify:** `cd web && npm test && npx tsc --noEmit && npm run build`, plus screenshots under `docs/design/screens/`

```json:metadata
{"files": ["web/src/features/GlossaryPage.tsx", "web/src/features/LinePage.tsx", "web/src/features/HomePage.tsx", "web/src/features/NotFound.tsx"], "verifyCommand": "cd web && npm test && npx tsc --noEmit && npm run build", "acceptanceCriteria": ["glossary anchors", "sortable line leaderboard with fleet strip", "home leaders + search", "notfound"], "modelTier": "standard"}
```
