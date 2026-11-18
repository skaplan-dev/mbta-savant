export const METRICS = [
    'ttoe_sec',
    'speed_vs_expected_pct',
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
    // ttoe_sec / speed_vs_expected_pct minus the group's average (qualified, ranked) car; display-only.
    ttoe_vs_avg_sec: number | null;
    speed_vs_avg_pct: number | null;
    // Shown as a fun fact; never ranked, so its pct is always null.
    top_speed_mph: number | null;
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

export interface GroupFile {
    group: string;
    window: string;
    generated_at: string;
    qualify_min_trips: number;
    averages: { ttoe_sec: number | null; speed_vs_expected_pct: number | null };
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

// Metrics shown without a percentile. Keep in sync with the null-direction entries of METRICS in
// pipeline/savant/publish.py.
export const UNRANKED: ReadonlySet<Metric> = new Set<Metric>(['top_speed_mph', 'crowd_load_pct']);

// Signed values ("+4.2%") for metrics that read as better or worse than expected.
export function fmtMetric(m: Metric, v: number | string[] | null | undefined): string {
    if (m === 'speed_vs_expected_pct' && typeof v === 'number')
        return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
    return fmt(v);
}

// Metrics displayed against the line's average car; the pct stays the absolute metric's pct.
export const VS_AVG = {
    ttoe_sec: { field: 'ttoe_vs_avg_sec', label: 'TTOE vs avg', unit: ' s' },
    speed_vs_expected_pct: { field: 'speed_vs_avg_pct', label: 'Speed vs avg', unit: '%' },
} as const satisfies Partial<
    Record<Metric, { field: keyof CarStats; label: string; unit: string }>
>;

export type VsAvgMetric = keyof typeof VS_AVG;

export const isVsAvg = (m: Metric): m is VsAvgMetric => m in VS_AVG;

// "−2.1 s vs avg", "+0.4% vs avg"
export function fmtVsAvg(m: VsAvgMetric, v: number | null | undefined): string {
    if (v === null || v === undefined) return '-';
    const sign = v > 0 ? '+' : v < 0 ? '\u2212' : '';
    return `${sign}${Math.abs(v).toFixed(1)}${VS_AVG[m].unit} vs avg`;
}

export function fmt(v: number | string[] | null | undefined): string {
    if (v === null || v === undefined) return '-';
    if (Array.isArray(v)) return v.join(', ');
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export type IndexFile = IndexEntry[];

export interface FleetSummary {
    fleet_label: string;
    cars: number;
    median: Partial<Record<Metric | 'ttoe_vs_avg_sec' | 'speed_vs_avg_pct', number | null>>;
}

// window -> fleet key -> summary
export type FleetsFile = Record<string, Record<string, FleetSummary>>;

export const fetchIndex = (window: string) => getJson<IndexFile>(`/data/${window}/index.json`);
export const fetchFleets = (group: string) => getJson<FleetsFile>(`/data/fleets/${group}.json`);
