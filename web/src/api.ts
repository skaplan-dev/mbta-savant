import type { GroupId } from './groups';

export type Metric =
    | 'tar'
    | 'travel_time_sec'
    | 'dwell_time_sec'
    | 'on_time_pct'
    | 'steadiness_sec'
    | 'games_played_pct'
    | 'iron_horse_days'
    | 'miles'
    | 'routes'
    | 'crowd_load_pct';

export interface WindowInfo {
    key: string;
    start: string;
    end: string;
}

export interface Meta {
    generated_at: string;
    windows: WindowInfo[];
    latest_service_date: string | null;
    /** Each line's season when the URL names none. Optional until every published meta.json has it. */
    default_season?: Partial<Record<GroupId, string>>;
}

/** One line's card on the home page (home.json), in that line's default season. */
export interface HomeCard {
    season: string;
    /** Top cars by TAR, best first. */
    leaders: IndexEntry[];
    /** Every car's number, only when none is ranked (Mattapan). */
    cars: string[];
}

export type HomeFile = Partial<Record<GroupId, HomeCard>>;

export interface IndexEntry {
    car_id: string;
    group: GroupId;
    number: string;
    fleet_label: string;
    qualified: boolean;
    ranked: boolean;
    /** Seconds per trip against the line's typical car (positive = slower). */
    travel_vs_typical_sec: number | null;
    pct_travel: number | null;
    /** Trips above replacement and its percentile. Optional until every published index has them. */
    tar?: number | null;
    pct_tar?: number | null;
}

/** The line constants TAR is converted with, published per group, route and summary. */
export interface TarConstants {
    /** Median trip duration (first departure to last arrival), seconds. */
    trip_len_sec?: number | null;
    /** Median over ranked cars of trips per service day. */
    trips_per_day?: number | null;
    /** The 20th-percentile (replacement) value of each input. */
    tar_replacement?: {
        service_share: number | null;
        fast_sec: number | null;
        steady_adj_sec: number | null;
    };
}

export interface Vehicle {
    group?: string;
    number?: string;
    fleet_key: string;
    fleet_label: string;
    builder?: string;
    model?: string;
    propulsion?: string;
    years?: string;
    length_ft?: number;
    garage?: string | null;
}

export type Pct = Record<Metric, number | null>;

export interface CarStats {
    car_id: string;
    number: string;
    trips: number;
    qualified: boolean;
    ranked: boolean;
    // Per-trip timing, optional until every published data file has it (the site can deploy before the nightly rebuild).
    travel_time_sec?: number | null;
    dwell_time_sec?: number | null;
    exp_travel_sec?: number | null;
    // Centered on the line's typical car (median of ranked cars): positive = slower; the UI negates for "saved".
    travel_vs_typical_sec?: number | null;
    dwell_vs_typical_sec?: number | null;
    travel_vs_typical_pct?: number | null;
    on_time_pct: number | null;
    steadiness_sec: number | null;
    games_played_pct: number | null;
    iron_horse_days: number | null;
    miles: number | null;
    // Count of distinct routes served in the window; buses only (rail is null). Per-day route lists are in game_log[].routes.
    routes: number | null;
    crowd_load_pct: number | null;
    /** Latest service date in any window (ISO). Optional until every published data file has it. */
    last_seen?: string | null;
    /** Trips above replacement (null: unranked). */
    tar?: number | null;
    /** The three parts, each rounded separately, so they may differ from `tar` by a trip. */
    tar_parts?: { field: number; speed: number; steady: number } | null;
    /** Earliest service date ever (ISO). */
    first_seen?: string | null;
    /** True when first_seen limits eligible_days (the car's fleet was still being delivered). */
    new_delivery?: boolean | null;
    /** Data days in the window on or after first_seen. */
    eligible_days?: number | null;
    /** Days in the window the car ran enough trips to count. */
    service_days?: number | null;
    /** Route-adjusted steadiness per segment; higher is steadier. */
    steady_adj_sec?: number | null;
    teammates: [string, number][];
    vehicle: Vehicle;
    pct: Pct;
}

export interface GameLogEntry {
    date: string;
    trips: number;
    miles: number | null;
    travel_time_sec: number | null;
    routes: string[];
}

export interface Car extends CarStats {
    game_log: GameLogEntry[];
}

/** The line-wide numbers a car page needs, without every car (groups/<group>.summary.json). */
export interface GroupSummary extends TarConstants {
    group: GroupId;
    window: string;
    generated_at: string;
    qualify_min_trips: number;
    /** Qualified, roster-listed cars the percentiles are among. */
    ranked_cars: number;
    /** Optional: files built before the per-trip stats lack these. */
    segs_per_trip?: number | null;
    typical?: GroupFile['typical'];
    too_close?: Metric[];
    spread?: GroupFile['spread'];
}

export interface GroupFile extends TarConstants {
    group: GroupId;
    window: string;
    generated_at: string;
    qualify_min_trips: number;
    /** Average segments per trip on the line. */
    segs_per_trip?: number | null;
    /** The typical car's (median of ranked cars) absolute values. */
    typical?: Partial<Record<'travel_time_sec' | 'dwell_time_sec', number | null>>;
    /** Stats where the line's cars are bunched together (still ranked; the site notes it). */
    too_close?: Metric[];
    /** Gap between the 10th- and 90th-percentile ranked cars, per stat that can be too close (null: too few cars). */
    spread?: Partial<Record<Metric, number | null>>;
    cars: CarStats[];
}

/** One bus route's board (routes/<route>.json): the bus line file, ranked among buses on that route. */
export interface RouteFile extends GroupFile {
    route: string;
}

/** routes/index.json: every route that ran in a window. */
export interface RouteIndexEntry {
    route: string;
    buses: number;
    ranked_cars: number;
    trips: number;
}

export interface FleetSummary {
    fleet_label: string;
    cars: number;
    median: Partial<
        Record<
            Metric | 'travel_vs_typical_sec' | 'dwell_vs_typical_sec' | 'travel_vs_typical_pct',
            number | null
        >
    >;
}

// window -> fleet key -> summary
export type FleetsFile = Record<string, Record<string, FleetSummary>>;

/** Resolves null when the file doesn't exist (or the server answered with its HTML fallback). */
async function getJson<T>(path: string): Promise<T | null> {
    const res = await fetch(path);

    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return null;

    // Every file under /data is written by our own pipeline (pipeline/savant/publish.py).
    const body: T = await res.json();

    return body;
}

export const fetchMeta = () => getJson<Meta>('/data/meta.json');

export const fetchHome = () => getJson<HomeFile>('/data/home.json');

export const fetchIndex = (window: string) => getJson<IndexEntry[]>(`/data/${window}/index.json`);

export const fetchGroup = (window: string, group: GroupId) =>
    getJson<GroupFile>(`/data/${window}/groups/${group}.json`);

export const fetchGroupSummary = (window: string, group: GroupId) =>
    getJson<GroupSummary>(`/data/${window}/groups/${group}.summary.json`);

export const fetchCar = (window: string, group: GroupId, number: string) =>
    getJson<Car>(`/data/${window}/cars/${group}/${number}.json`);

export const fetchFleets = (group: GroupId) => getJson<FleetsFile>(`/data/fleets/${group}.json`);

export const fetchRoute = (window: string, route: string) =>
    getJson<RouteFile>(`/data/${window}/routes/${encodeURIComponent(route)}.json`);

export const fetchRouteIndex = (window: string) =>
    getJson<RouteIndexEntry[]>(`/data/${window}/routes/index.json`);
