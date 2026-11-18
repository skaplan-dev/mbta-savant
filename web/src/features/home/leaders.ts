import type { IndexEntry } from '../../api';
import { byNumber, compareNullsLast } from '../../compare';
import { timeSaved } from '../../format';
import { isRanked } from '../../rank';

/** Top `n` ranked, qualified entries by Time Saved, best first. `entries` are one group's. */
export const topLeaders = (entries: readonly IndexEntry[], n = 5): IndexEntry[] =>
    entries
        .filter((e) => isRanked(e.group, e) && timeSaved(e) != null)
        .sort((a, b) => compareNullsLast(timeSaved(a), timeSaved(b), 'desc') || byNumber(a, b))
        .slice(0, n);
