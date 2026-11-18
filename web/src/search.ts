// Optional `?season=` on the line and car routes. TanStack's default search parser turns
// `?season=2026` into the number 2026, so numbers are accepted and normalized to strings.
// Anything that isn't a year or "last30" is dropped (the page then uses its default season).
export function validateSeasonSearch(search: Record<string, unknown>): { season?: string } {
    const raw: unknown = search.season;
    const s = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw : '';
    return /^(\d{4}|last30)$/.test(s) ? { season: s } : {};
}

/** The URL value for a season: years as numbers so the URL reads `?season=2026`, not `"2026"`. */
export const seasonParam = (k: string): string | number => (/^\d{4}$/.test(k) ? Number(k) : k);

export interface SearchEntry {
    car_id: string;
    group: string;
    number: string;
    fleet_label: string;
    /** The newest window (in the order given) whose index lists this car. */
    window: string;
}

/**
 * Merges every window's index into one list for search, deduped by group + number. `windows` is
 * newest first, so a car keeps the newest window it appears in.
 */
export function mergeIndexes(
    windows: readonly string[],
    indexes: Readonly<
        Record<
            string,
            | readonly { car_id: string; group: string; number: string; fleet_label: string }[]
            | null
            | undefined
        >
    >
): SearchEntry[] {
    const seen = new Map<string, SearchEntry>();
    for (const w of windows) {
        for (const e of indexes[w] ?? []) {
            const key = `${e.group}:${e.number}`;
            if (!seen.has(key))
                seen.set(key, {
                    car_id: e.car_id,
                    group: e.group,
                    number: e.number,
                    fleet_label: e.fleet_label,
                    window: w,
                });
        }
    }
    return [...seen.values()];
}
