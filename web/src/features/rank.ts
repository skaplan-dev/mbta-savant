import type { CarStats } from '../api';

/** Why a car has no bubbles, or null when it is ranked. */
export function unrankedReason(
    group: string,
    car: Pick<CarStats, 'ranked' | 'qualified'>,
    qualifyMin: number | undefined
): string | null {
    if (group === 'mattapan') return 'Mattapan cars aren’t ranked.';

    if (!car.ranked) return 'Not in the vehicle roster, so not ranked.';

    if (!car.qualified)
        return `Not enough trips this season to be ranked${qualifyMin ? ` (needs ${qualifyMin.toLocaleString('en-US')})` : ''}.`;

    return null;
}

export const isRanked = (group: string, car: Pick<CarStats, 'ranked' | 'qualified'>) =>
    group !== 'mattapan' && car.ranked && car.qualified;
