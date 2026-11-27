import type { IndexEntry } from './api';
import { compareNumeric } from './compare';
import { GROUP_IDS } from './groups';
import { CAREER } from './seasons';

export interface SearchEntry extends Pick<
    IndexEntry,
    'car_id' | 'group' | 'number' | 'fleet_label'
> {
    /** The newest window (in the order given) whose index lists this car. */
    window: string;
}

/**
 * Merges every window's index into one list for search, deduped by group + number and sorted by
 * number. `windows` is newest first, so a car keeps the newest window it appears in.
 */
export function mergeIndexes(
    windows: readonly string[],
    indexes: ReadonlyMap<string, readonly IndexEntry[] | null | undefined>
): SearchEntry[] {
    const seen = new Map<string, SearchEntry>();
    // All-time lists every car; visit it last so a car's window is a real season whenever one has it.
    const order = [...windows.filter((w) => w !== CAREER), ...windows.filter((w) => w === CAREER)];

    for (const window of order) {
        for (const { car_id, group, number, fleet_label } of indexes.get(window) ?? []) {
            const key = `${group}:${number}`;

            if (!seen.has(key)) seen.set(key, { car_id, group, number, fleet_label, window });
        }
    }

    return [...seen.values()].sort(
        (a, b) =>
            compareNumeric(a.number, b.number) ||
            GROUP_IDS.indexOf(a.group) - GROUP_IDS.indexOf(b.group)
    );
}

/** Up to `max` entries whose number starts with `term`; an exact number match comes first. */
export function matchCars(
    entries: readonly SearchEntry[],
    term: string,
    max: number
): SearchEntry[] {
    const hits = entries.filter((e) => e.number.startsWith(term));
    const exact = hits.filter((e) => e.number === term);

    return [...exact, ...hits.filter((e) => e.number !== term)].slice(0, max);
}

/**
 * The `?season=` a result links to: none for the default window, else the window that has the car.
 * Never All-time: the car page then picks its usual season.
 */
export const linkSeason = (e: SearchEntry, defaultWindow: string | undefined) =>
    e.window === defaultWindow || e.window === CAREER ? undefined : e.window;
