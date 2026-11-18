import {
    arrayOf,
    fields,
    isBoolean,
    isNumber,
    isString,
    nullable,
    optional,
    pair,
    record,
    type Fields,
    type Guard,
} from './decode';
import { isGroup, type GroupId } from './groups';

export type Metric =
    | 'ttoe_sec'
    | 'speed_vs_expected_pct'
    | 'top_speed_mph'
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
}

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
    group: GroupId;
    window: string;
    generated_at: string;
    qualify_min_trips: number;
    averages: { ttoe_sec: number | null; speed_vs_expected_pct: number | null };
    cars: CarStats[];
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

const num = nullable(isNumber);
const isGroupId = (v: unknown): v is GroupId => isString(v) && isGroup(v);

const isMeta = fields<Meta>({
    generated_at: isString,
    windows: arrayOf(fields<WindowInfo>({ key: isString, start: isString, end: isString })),
    latest_service_date: nullable(isString),
});

const isIndex = arrayOf(
    fields<IndexEntry>({
        car_id: isString,
        group: isGroupId,
        number: isString,
        fleet_label: isString,
        qualified: isBoolean,
        ranked: isBoolean,
        ttoe_sec: num,
        ttoe_vs_avg_sec: num,
        pct_ttoe: num,
    })
);

const optString = optional(isString);

const isVehicle = fields<Vehicle>({
    group: optString,
    number: optString,
    fleet_key: isString,
    fleet_label: isString,
    builder: optString,
    model: optString,
    propulsion: optString,
    years: optString,
    length_ft: optional(isNumber),
    garage: optional(nullable(isString)),
});

const isPct = fields<Pct>({
    ttoe_sec: num,
    speed_vs_expected_pct: num,
    top_speed_mph: num,
    on_time_pct: num,
    steadiness_sec: num,
    door_time_sec: num,
    games_played_pct: num,
    iron_horse_days: num,
    miles: num,
    routes: num,
    crowd_load_pct: num,
});

const carStatsFields = {
    car_id: isString,
    number: isString,
    trips: isNumber,
    qualified: isBoolean,
    ranked: isBoolean,
    ttoe_sec: num,
    speed_vs_expected_pct: num,
    ttoe_vs_avg_sec: num,
    speed_vs_avg_pct: num,
    door_vs_avg_sec: optional(num),
    top_speed_mph: num,
    on_time_pct: num,
    steadiness_sec: num,
    door_time_sec: num,
    games_played_pct: num,
    iron_horse_days: num,
    miles: num,
    routes: num,
    crowd_load_pct: num,
    teammates: arrayOf(pair(isString, isNumber)),
    vehicle: isVehicle,
    pct: isPct,
} satisfies Fields<CarStats>;

const isCar = fields<Car>({
    ...carStatsFields,
    game_log: arrayOf(
        fields<GameLogEntry>({
            date: isString,
            trips: isNumber,
            miles: num,
            ttoe_sec: num,
            routes: arrayOf(isString),
        })
    ),
});

const isGroupFile = fields<GroupFile>({
    group: isGroupId,
    window: isString,
    generated_at: isString,
    qualify_min_trips: isNumber,
    averages: fields<GroupFile['averages']>({ ttoe_sec: num, speed_vs_expected_pct: num }),
    cars: arrayOf(fields<CarStats>(carStatsFields)),
});

const isFleets = record(
    record(
        fields<FleetSummary>({
            fleet_label: isString,
            cars: isNumber,
            median: record(num),
        })
    )
);

/**
 * Resolves null when the file doesn't exist (or the server answered with HTML); rejects on a
 * network error or a file that doesn't match its type.
 */
async function getJson<T>(path: string, guard: Guard<T>): Promise<T | null> {
    const res = await fetch(path);

    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return null;
    const body: unknown = await res.json();

    if (!guard(body)) throw new Error(`Unexpected data in ${path}`);

    return body;
}

export const fetchMeta = () => getJson('/data/meta.json', isMeta);

export const fetchIndex = (window: string) => getJson(`/data/${window}/index.json`, isIndex);

export const fetchGroup = (window: string, group: GroupId) =>
    getJson(`/data/${window}/groups/${group}.json`, isGroupFile);

export const fetchCar = (window: string, group: GroupId, number: string) =>
    getJson(`/data/${window}/cars/${group}/${number}.json`, isCar);

export const fetchFleets = (group: GroupId) => getJson(`/data/fleets/${group}.json`, isFleets);
