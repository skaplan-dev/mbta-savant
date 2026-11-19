import type { CarStats } from './api';
import { GROUPS, type GroupId } from './groups';

type RankFlags = Pick<CarStats, 'ranked' | 'qualified'>;

export const UNRANKED_LINE_NOTE = 'Mattapan’s handful of trolleys get stats but aren’t ranked.';

export function unrankedReason(
    group: GroupId,
    car: RankFlags,
    qualifyMin: number | undefined
): string | null {
    if (!GROUPS[group].ranked) return `${GROUPS[group].short} cars aren’t ranked.`;

    if (!car.ranked) return 'Not in the vehicle roster, so not ranked.';

    if (!car.qualified)
        return `Not enough trips`

    return null;
}

export const isRanked = (group: GroupId, car: RankFlags) =>
    GROUPS[group].ranked && car.ranked && car.qualified;
