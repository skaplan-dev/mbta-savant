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
