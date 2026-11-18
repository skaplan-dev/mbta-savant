import type { CarStats, Metric } from '../../api';
import { doorLabel, fmtNum, pacePlus, signed, timeSaved, type GroupId } from '../../format';
import type { StatId } from '../../glossary';

export type SortKey = 'rank' | 'car' | 'fleet' | 'trips' | StatId;
export type SortDir = 'asc' | 'desc';
export interface Sort {
    key: SortKey;
    dir: SortDir;
}

export interface StatCol {
    id: StatId;
    pct: Metric;
    /** Numeric value that the cell displays, so sorting matches what is shown. */
    value: (c: CarStats) => number | null;
    text: (c: CarStats) => string;
    /** Smaller values are better (best-first is ascending). */
    lowerBetter?: boolean;
}

const int = (v: number | null) => (v == null ? '–' : Math.round(v).toLocaleString('en-US'));

const PERFORMANCE: StatCol[] = [
    {
        id: 'time-saved',
        pct: 'ttoe_sec',
        value: timeSaved,
        text: (c) => signed(timeSaved(c), 1, ' s'),
    },
    {
        id: 'pace-plus',
        pct: 'speed_vs_expected_pct',
        value: pacePlus,
        text: (c) => int(pacePlus(c)),
    },
    {
        id: 'on-schedule',
        pct: 'on_time_pct',
        value: (c) => c.on_time_pct,
        text: (c) => (c.on_time_pct == null ? '–' : `${fmtNum(c.on_time_pct, 1)}%`),
    },
    {
        id: 'consistency',
        pct: 'steadiness_sec',
        value: (c) => c.steadiness_sec,
        text: (c) => (c.steadiness_sec == null ? '–' : `${Math.round(c.steadiness_sec)} s`),
        lowerBetter: true,
    },
    {
        id: 'door-time',
        pct: 'door_time_sec',
        value: (c) => c.door_time_sec,
        text: (c) => doorLabel(c.door_time_sec),
        lowerBetter: true,
    },
];

const WORKLOAD: StatCol[] = [
    {
        id: 'days-in-service',
        pct: 'games_played_pct',
        value: (c) => c.games_played_pct,
        text: (c) => (c.games_played_pct == null ? '–' : `${Math.round(c.games_played_pct)}%`),
    },
    {
        id: 'iron-horse',
        pct: 'iron_horse_days',
        value: (c) => c.iron_horse_days,
        text: (c) => (c.iron_horse_days == null ? '–' : `${c.iron_horse_days} d`),
    },
];

const MILES: StatCol = {
    id: 'miles',
    pct: 'miles',
    value: (c) => c.miles,
    text: (c) => int(c.miles),
};
const ROUTES: StatCol = {
    id: 'routes-run',
    pct: 'routes',
    value: (c) => c.routes,
    text: (c) => int(c.routes),
};

/** Stat columns for a line: Miles Logged for rail, Routes Run for buses. */
export const statCols = (group: GroupId): StatCol[] => [
    ...PERFORMANCE,
    ...WORKLOAD,
    group === 'bus' ? ROUTES : MILES,
];

export const isRankedCar = (group: string, c: Pick<CarStats, 'qualified' | 'ranked'>) =>
    group !== 'mattapan' && c.qualified && c.ranked;

const byNumber = (a: CarStats, b: CarStats) =>
    a.number.localeCompare(b.number, undefined, { numeric: true });

function compareNullsLast(a: number | null, b: number | null, dir: SortDir): number {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return dir === 'asc' ? a - b : b - a;
}

/** Cars ordered best Time Saved first (pct, then the value); the position is the car's rank. */
export function rankCars(cars: readonly CarStats[]): CarStats[] {
    return [...cars].sort(
        (a, b) =>
            compareNullsLast(a.pct.ttoe_sec, b.pct.ttoe_sec, 'desc') ||
            compareNullsLast(timeSaved(a), timeSaved(b), 'desc') ||
            byNumber(a, b)
    );
}

/** The direction a first click on a column uses: best first for stats, natural order otherwise. */
export function firstDir(key: SortKey, group: GroupId): SortDir {
    if (key === 'car' || key === 'fleet' || key === 'rank') return 'asc';
    const col = statCols(group).find((c) => c.id === key);
    return col?.lowerBetter ? 'asc' : 'desc';
}

/** Sorts rows (already in rank order). Ties fall back to rank, so the result is stable. */
export function sortCars(
    ranked: readonly CarStats[],
    sort: Sort,
    group: GroupId
): { car: CarStats; rank: number }[] {
    const rows = ranked.map((car, i) => ({ car, rank: i + 1 }));
    const cols = statCols(group);
    const col = cols.find((c) => c.id === sort.key);
    const sign = sort.dir === 'asc' ? 1 : -1;
    const cmp = (x: (typeof rows)[number], y: (typeof rows)[number]): number => {
        switch (sort.key) {
            case 'rank':
                return sign * (x.rank - y.rank);
            case 'car':
                return sign * byNumber(x.car, y.car);
            case 'fleet':
                return sign * x.car.vehicle.fleet_label.localeCompare(y.car.vehicle.fleet_label);
            case 'trips':
                return sign * (x.car.trips - y.car.trips);
            default:
                return col ? compareNullsLast(col.value(x.car), col.value(y.car), sort.dir) : 0;
        }
    };
    return rows.sort((x, y) => cmp(x, y) || x.rank - y.rank);
}

/** Cars with trips that have no percentile ranking, and why. */
export function unrankedCars(
    group: GroupId,
    cars: readonly CarStats[],
    qualifyMin: number | undefined
): { car: CarStats; reason: string }[] {
    return cars
        .filter((c) => c.trips > 0 && !isRankedCar(group, c))
        .sort((a, b) => b.trips - a.trips || byNumber(a, b))
        .map((car) => ({
            car,
            reason:
                group === 'mattapan'
                    ? 'Mattapan cars aren’t ranked'
                    : !car.ranked
                      ? 'Not in the vehicle roster'
                      : `Too few trips${qualifyMin ? ` (needs ${qualifyMin.toLocaleString('en-US')})` : ''}`,
        }));
}
