import { useQueries, useQuery } from '@tanstack/react-query';
import { orderWindows } from './features/car/season';
import { fetchFleets, fetchGroup, fetchIndex, fetchMeta, type IndexEntry, type Meta } from './api';

const staleTime = 60 * 60 * 1000;

// A missing file resolves to null (never an error).
export const useMeta = () => useQuery({ queryKey: ['meta'], queryFn: fetchMeta, staleTime });

export const useIndex = (window: string | undefined) =>
    useQuery({
        queryKey: ['index', window],
        queryFn: () => fetchIndex(window!),
        enabled: !!window,
        staleTime,
    });

export const useGroup = (window: string, group: string) =>
    useQuery({
        queryKey: ['group', window, group],
        queryFn: () => fetchGroup(window, group),
        // Never request /data//groups/... while the season is still unknown.
        enabled: !!window && !!group,
        staleTime,
    });

export const useFleets = (group: string) =>
    useQuery({ queryKey: ['fleets', group], queryFn: () => fetchFleets(group), staleTime });

// The newest calendar-year window, else the first window listed.
export function defaultWindow(meta: Meta | null | undefined): string | undefined {
    if (!meta) return undefined;
    const years = meta.windows.map((w) => w.key).filter((k) => /^\d{4}$/.test(k));

    return years.sort().at(-1) ?? meta.windows[0]?.key;
}

/**
 * Every window's index (newest year first, last30 last), cached under the same keys as `useIndex`.
 * With `enabled` false nothing is fetched, but anything already cached is still returned.
 */
export function useAllIndexes(enabled = true) {
    const { data: meta, isPending: metaPending } = useMeta();
    const windows = meta ? orderWindows(meta.windows.map((w) => w.key)) : [];

    const results = useQueries({
        queries: windows.map((w) => ({
            queryKey: ['index', w],
            queryFn: () => fetchIndex(w),
            staleTime,
            enabled,
        })),
    });

    const indexes: Record<string, IndexEntry[] | null | undefined> = {};
    windows.forEach((w, i) => (indexes[w] = results[i].data));

    return {
        meta,
        windows,
        indexes,
        // Pending while meta or any window's index is still loading (never for a disabled, empty query).
        loading: metaPending || (enabled && results.some((r) => r.isPending)),
    };
}
