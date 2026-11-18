// Which window a car page shows, and in what order the season toggle lists windows.

export interface SeasonCandidate {
    qualified: boolean;
    ranked: boolean;
}

/** Calendar-year windows newest first, then last30; anything else is dropped. */
export function orderWindows(keys: readonly string[]): string[] {
    const years = keys.filter((k) => /^\d{4}$/.test(k)).sort((a, b) => b.localeCompare(a));

    return keys.includes('last30') ? [...years, 'last30'] : years;
}

/**
 * The default season for a car: the newest year where it was ranked, else the newest year with
 * any file, else last30. `cars` maps window → the car's file for that window (null when missing).
 * Returns undefined when the car has no file in any window.
 */
export function defaultSeason(
    keys: readonly string[],
    cars: Readonly<Record<string, SeasonCandidate | null | undefined>>
): string | undefined {
    const ordered = orderWindows(keys);
    const years = ordered.filter((k) => k !== 'last30' && cars[k]);

    return (
        years.find((k) => cars[k]!.qualified && cars[k]!.ranked) ??
        years[0] ??
        (cars.last30 ? 'last30' : undefined)
    );
}

/**
 * The season to show: a requested window that exists in meta wins (even when this car has no file
 * for it, so the page can say so); otherwise the default.
 */
export function resolveSeason(
    requested: string | undefined,
    keys: readonly string[],
    cars: Readonly<Record<string, SeasonCandidate | null | undefined>>
): string | undefined {
    if (requested && keys.includes(requested)) return requested;

    return defaultSeason(keys, cars);
}
