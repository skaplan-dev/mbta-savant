import type { GroupId } from './groups';

export type Metric =
    | 'ttoe_sec'
    | 'speed_vs_expected_pct'
    | 'on_time_pct'
    | 'steadiness_sec'
    | 'door_time_sec'
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
    /** Top cars by Time Saved, best first. */
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
    ttoe_sec: number | null;
    ttoe_vs_avg_sec: number | null;
    pct_ttoe: number | null;
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
    ttoe_sec: number | null;
    speed_vs_expected_pct: number | null;
    // ttoe_sec / speed_vs_expected_pct / door_time_sec minus the group's average (qualified, ranked) car; display-only.
    ttoe_vs_avg_sec: number | null;
    speed_vs_avg_pct: number | null;
    // Optional until every published data file has it (the site can deploy before the nightly rebuild).
    door_vs_avg_sec?: number | null;
    on_time_pct: number | null;
    steadiness_sec: number | null;
    door_time_sec: number | null;
    games_played_pct: number | null;
    iron_horse_days: number | null;
    miles: number | null;
    // Count of distinct routes served in the window; buses only (rail is null). Per-day route lists are in game_log[].routes.
    routes: number | null;
    crowd_load_pct: number | null;
    teammates: [string, number][];
    vehicle: Vehicle;
    pct: Pct;
}

export interface GameLogEntry {
    date: string;
    trips: number;
    miles: number | null;
    ttoe_sec: number | null;
    routes: string[];
}

export interface Car extends CarStats {
    game_log: GameLogEntry[];
}

/** The line-wide numbers a car page needs, without every car (groups/<group>.summary.json). */
export interface GroupSummary {
    group: GroupId;
    window: string;
    generated_at: string;
    qualify_min_trips: number;
    /** Qualified, roster-listed cars the percentiles are among. */
    ranked_cars: number;
    averages: GroupFile['averages'];
}

export interface GroupFile {
    group: GroupId;
    window: string;
    generated_at: string;
    qualify_min_trips: number;
    averages: { ttoe_sec: number | null; speed_vs_expected_pct: number | null };
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
        Record<Metric | 'ttoe_vs_avg_sec' | 'speed_vs_avg_pct' | 'door_vs_avg_sec', number | null>
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
