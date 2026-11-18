// Season windows: calendar years ("2026") plus the rolling "last30".

export const LAST30 = 'last30';

export const isYearKey = (k: string) => /^\d{4}$/.test(k);

const isSeasonKey = (k: string | undefined): k is string =>
    k !== undefined && (isYearKey(k) || k === LAST30);

export const seasonLabel = (k: string): string => (k === LAST30 ? 'Last 30 Days' : k);

/** Calendar-year windows newest first, then last30; anything else is dropped. */
export function orderWindows(keys: readonly string[]): string[] {
    const years = keys.filter(isYearKey).sort((a, b) => b.localeCompare(a));

    return keys.includes(LAST30) ? [...years, LAST30] : years;
}

/**
 * The season to show: a requested window that exists wins (even one without data, so the page can
 * say so); otherwise the first window, in order, passing the first preference that any passes.
 */
export function resolveSeason(
    requested: string | undefined,
    windows: readonly string[],
    ...prefer: ((w: string) => boolean)[]
): string | undefined {
    if (requested && windows.includes(requested)) return requested;

    for (const p of prefer) {
        const hit = windows.find(p);

        if (hit) return hit;
    }

    return undefined;
}

export interface SeasonSearch {
    season?: string;
}

// Optional `?season=` on the line and car routes; anything that isn't a year or "last30" is dropped
// (the page then uses its default season). The router keeps search values as raw strings (main.tsx).
export const validateSeasonSearch = ({ season }: SeasonSearch): SeasonSearch =>
    isSeasonKey(season) ? { season } : {};
