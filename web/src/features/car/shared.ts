import type { Car } from '../../api';
import { compareNumeric } from '../../compare';
import { seasonLabel } from '../../seasons';

/** The married partner: the first teammate when they share at least 95% of this car's trips. */
export function marriedMate(car: Pick<Car, 'teammates' | 'trips'>): string | null {
    const first = car.teammates[0];

    return first && car.trips > 0 && first[1] / car.trips >= 0.95 ? first[0] : null;
}

export const noSeasonData = (noun: string, number: string, season: string) =>
    `${noun} ${number} has no data for ${seasonLabel(season)}. Pick another season above.`;

export interface RouteCount {
    route: string;
    days: number;
}

export function routeCounts(car: Pick<Car, 'game_log'>): RouteCount[] {
    const m = new Map<string, number>();

    for (const g of car.game_log) for (const r of g.routes) m.set(r, (m.get(r) ?? 0) + 1);

    return [...m]
        .map(([route, days]) => ({ route, days }))
        .sort((a, b) => b.days - a.days || compareNumeric(a.route, b.route));
}

/** The label / bar / value grid shared by the percentile rows and the TAR block. */
export const COLS = 'grid grid-cols-[32%_minmax(0,1fr)_72px]';
