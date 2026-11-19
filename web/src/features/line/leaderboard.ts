import type { CarStats, GroupFile } from '../../api';
import { byNumber, compareNullsLast } from '../../compare';
import type { StatId } from '../../glossary';
import type { GroupId } from '../../groups';
import { unrankedReason } from '../../rank';
import { boardStats } from '../../stats';

export type SortKey = 'rank' | 'car' | 'fleet' | 'trips' | StatId;

export type SortDir = 'asc' | 'desc';

export interface Sort {
    key: SortKey;
    dir: SortDir;
}

export interface UnrankedCar {
    car: CarStats;
    reason: string;
}

export interface LineCars {
    /** Ranked cars, best TAR first (pct, then the value); the position is the car's rank. */
    ranked: CarStats[];
    /** Cars with trips that have no percentile ranking, most trips first, and why. */
    unranked: UnrankedCar[];
}

export function splitCars(group: GroupId, file: GroupFile): LineCars {
    const ranked: CarStats[] = [];
    const unranked: UnrankedCar[] = [];

    for (const car of file.cars) {
        const reason = unrankedReason(group, car);

        if (!reason) ranked.push(car);
        else if (car.trips > 0) unranked.push({ car, reason });
    }

    return {
        ranked: rankCars(ranked),
        unranked: unranked.sort((a, b) => b.car.trips - a.car.trips || byNumber(a.car, b.car)),
    };
}

export function rankCars(cars: readonly CarStats[]): CarStats[] {
    return [...cars].sort(
        (a, b) =>
            compareNullsLast(a.pct.tar, b.pct.tar, 'desc') ||
            compareNullsLast(a.tar, b.tar, 'desc') ||
            byNumber(a, b)
    );
}

/** The direction a first click on a column uses: best first for stats, natural order otherwise. */
export function firstDir(key: SortKey, group: GroupId): SortDir {
    if (key === 'car' || key === 'fleet' || key === 'rank') return 'asc';

    return boardStats(group).find((c) => c.id === key)?.lowerBetter ? 'asc' : 'desc';
}

const seenAt = (c: CarStats) => (c.last_seen ? Date.parse(c.last_seen) : null);

export interface RankedRow {
    car: CarStats;
    rank: number;
}

/** Sorts rows (already in rank order). Ties fall back to rank, so the result is stable. */
export function sortCars(ranked: readonly CarStats[], sort: Sort, group: GroupId): RankedRow[] {
    const rows = ranked.map((car, i) => ({ car, rank: i + 1 }));
    const col = boardStats(group).find((c) => c.id === sort.key);
    const sign = sort.dir === 'asc' ? 1 : -1;

    const cmp = (x: RankedRow, y: RankedRow): number => {
        switch (sort.key) {
            case 'rank':
                return sign * (x.rank - y.rank);
            case 'car':
                return sign * byNumber(x.car, y.car);
            case 'fleet':
                return sign * x.car.vehicle.fleet_label.localeCompare(y.car.vehicle.fleet_label);
            case 'trips':
                return sign * (x.car.trips - y.car.trips);
            case 'last-seen':
                return compareNullsLast(seenAt(x.car), seenAt(y.car), sort.dir);
            default:
                return col ? compareNullsLast(col.value(x.car), col.value(y.car), sort.dir) : 0;
        }
    };

    return rows.sort((x, y) => cmp(x, y) || x.rank - y.rank);
}
