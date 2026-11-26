export const LAST30 = 'last30';
export const CAREER = 'career';

export const isYearKey = (k: string) => /^\d{4}$/.test(k);

const isSeasonKey = (k: string | undefined): k is string =>
    k !== undefined && (isYearKey(k) || k === LAST30 || k === CAREER);

export const seasonLabel = (k: string): string =>
    k === LAST30 ? 'Last 30 Days' : k === CAREER ? 'All-time' : k;

/** Career first, then calendar-year windows newest first, then last30; anything else is dropped. */
export function orderWindows(keys: readonly string[]): string[] {
    const years = keys.filter(isYearKey).sort((a, b) => b.localeCompare(a));

    return [
        ...(keys.includes(CAREER) ? [CAREER] : []),
        ...years,
        ...(keys.includes(LAST30) ? [LAST30] : []),
    ];
}

/** The window pages land on by default: newest year, else last30, else whatever is first (career only if alone). */
export const defaultWindow = (windows: readonly string[]): string | undefined =>
    windows.find(isYearKey) ?? windows.find((w) => w === LAST30) ?? windows[0];

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

// Optional `?season=` on the line and car routes; anything that isn't a year, "last30" or "career" is dropped
// (the page then uses its default season). `parseSearch` (search.ts) delivers the value as a string.
export const validateSeasonSearch = ({ season }: SeasonSearch): SeasonSearch =>
    isSeasonKey(season) ? { season } : {};
