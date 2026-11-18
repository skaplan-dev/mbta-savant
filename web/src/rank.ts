import type { CarStats, IndexEntry } from './api';
import { fmtInt } from './format';
import { GROUPS, type GroupId } from './groups';
import { isYearKey, LAST30, resolveSeason } from './seasons';

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
        return `Not enough trips this season to be ranked${qualifyMin ? ` (needs ${fmtInt(qualifyMin)})` : ''}.`;

    return null;
}

export const isRanked = (group: GroupId, car: RankFlags) =>
    GROUPS[group].ranked && car.ranked && car.qualified;

/**
 * A line's season: the requested one, else the newest year with a ranked car in the group, else
 * last30, else the first window.
 */
export const lineSeason = (
    group: GroupId,
    requested: string | undefined,
    windows: readonly string[],
    indexes: ReadonlyMap<string, readonly IndexEntry[] | null | undefined>
): string =>
    resolveSeason(
        requested,
        windows,
        (w) =>
            isYearKey(w) && !!indexes.get(w)?.some((e) => e.group === group && isRanked(group, e)),
        (w) => w === LAST30,
        () => true
    ) ?? LAST30;
