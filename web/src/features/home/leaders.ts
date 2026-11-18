import type { IndexEntry } from '../../api';

/** Top `n` ranked, qualified cars of a group by Time Saved (−ttoe_vs_avg_sec), best first. */
export function topLeaders(index: readonly IndexEntry[], group: string, n = 5): IndexEntry[] {
    return index
        .filter(
            (e) =>
                e.group === group &&
                group !== 'mattapan' &&
                e.qualified &&
                e.ranked &&
                e.ttoe_vs_avg_sec != null
        )
        .sort(
            (a, b) =>
                a.ttoe_vs_avg_sec! - b.ttoe_vs_avg_sec! ||
                a.number.localeCompare(b.number, undefined, { numeric: true })
        )
        .slice(0, n);
}

export const groupCars = (index: readonly IndexEntry[], group: string): IndexEntry[] =>
    index
        .filter((e) => e.group === group)
        .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
