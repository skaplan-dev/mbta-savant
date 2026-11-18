import { useQueries } from '@tanstack/react-query';
import { fetchIndex, type IndexEntry, type Meta } from '../../api';
import { useGroup, useMeta } from '../../queries';
import { orderWindows } from '../car/season';

export interface LineData {
    meta: Meta;
    /** Windows for the season toggle, newest first. */
    windows: string[];
    season: string;
}

/**
 * The default season for a line: the newest year with a ranked qualified car in the group, else
 * last30, else the newest window. `indexes` maps window → that window's index (null if missing).
 */
export function defaultLineSeason(
    group: string,
    windows: readonly string[],
    indexes: Readonly<Record<string, readonly IndexEntry[] | null | undefined>>
): string {
    const years = windows.filter((w) => w !== 'last30');
    const hit = years.find(
        (w) =>
            group !== 'mattapan' &&
            indexes[w]?.some((e) => e.group === group && e.qualified && e.ranked)
    );
    return hit ?? (windows.includes('last30') ? 'last30' : (windows[0] ?? 'last30'));
}

/** Resolves the season (requested, else the default); undefined while meta or indexes load. */
export function useLineData(group: string, requested: string | undefined): LineData | undefined {
    const { data: meta, isPending: metaPending } = useMeta();
    const windows = meta ? orderWindows(meta.windows.map((w) => w.key)) : [];
    const needDefault = !(requested && windows.includes(requested));
    const results = useQueries({
        queries: windows.map((w) => ({
            queryKey: ['index', w],
            queryFn: () => fetchIndex(w),
            staleTime: 60 * 60 * 1000,
            enabled: needDefault,
        })),
    });
    if (metaPending) return undefined;
    if (!meta)
        return {
            meta: { generated_at: '', windows: [], latest_service_date: null },
            windows,
            season: 'last30',
        };
    if (!needDefault) return { meta, windows, season: requested! };
    if (results.some((r) => r.isPending)) return undefined;
    const indexes = Object.fromEntries(windows.map((w, i) => [w, results[i].data]));
    return { meta, windows, season: defaultLineSeason(group, windows, indexes) };
}

export { useGroup };
