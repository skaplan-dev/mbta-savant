export const METRICS = [
    'ttoe_sec',
    'top_speed_mph',
    'on_time_pct',
    'steadiness_sec',
    'door_time_sec',
    'games_played_pct',
    'iron_horse_days',
    'miles',
    'routes',
    'crowd_load_pct',
] as const;

export type Metric = (typeof METRICS)[number];

export const GROUPS = ['red', 'orange', 'blue', 'green', 'mattapan', 'bus'] as const;

export interface WindowInfo {
    key: string;
    start: string;
    end: string;
}

export interface Meta {
    generated_at: string;
    windows: WindowInfo[];
    latest_service_date: string | null;
}

export interface IndexEntry {
    car_id: string;
    group: string;
    number: string;
    fleet_label: string;
    qualified: boolean;
    ttoe_sec: number | null;
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
    ttoe_sec: number | null;
    top_speed_mph: number | null;
    on_time_pct: number | null;
    steadiness_sec: number | null;
    door_time_sec: number | null;
    games_played_pct: number | null;
    iron_horse_days: number | null;
    miles: number | null;
    // Buses carry a route list; rail carries null.
    routes: string[] | null;
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

export interface GroupFile {
    group: string;
    window: string;
    generated_at: string;
    cars: CarStats[];
}

// Returns null when the file does not exist (or the server answered with HTML).
async function getJson<T>(path: string): Promise<T | null> {
    const res = await fetch(path);
    if (!res.ok) return null;
    if (!(res.headers.get('content-type') ?? '').includes('json')) return null;
    return (await res.json()) as T;
}

export const fetchMeta = () => getJson<Meta>('/data/meta.json');
export const fetchGroup = (window: string, group: string) =>
    getJson<GroupFile>(`/data/${window}/groups/${group}.json`);
export const fetchCar = (window: string, group: string, number: string) =>
    getJson<Car>(`/data/${window}/cars/${group}/${number}.json`);

export function fmt(v: number | string[] | null | undefined): string {
    if (v === null || v === undefined) return '-';
    if (Array.isArray(v)) return v.join(', ');
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
