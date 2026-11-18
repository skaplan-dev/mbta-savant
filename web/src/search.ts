// Optional `?season=` on the line and car routes.
export function validateSeasonSearch(search: Record<string, unknown>): { season?: string } {
    return typeof search.season === 'string' && search.season ? { season: search.season } : {};
}
