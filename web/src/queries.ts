import {
    queryOptions,
    skipToken,
    useQueries,
    useQuery,
    type UseQueryResult,
} from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import {
    fetchCar,
    fetchFleets,
    fetchGroup,
    fetchGroupSummary,
    fetchHome,
    fetchIndex,
    fetchMeta,
    fetchRoute,
    fetchRouteIndex,
    type IndexEntry,
    type RouteIndexEntry,
} from './api';
import type { GroupId } from './groups';
import { orderWindows } from './seasons';

// Every fetcher resolves null for a missing file, so "missing" is data, not an error.

export const metaQuery = queryOptions({ queryKey: ['meta'], queryFn: fetchMeta });

export const homeQuery = queryOptions({ queryKey: ['home'], queryFn: fetchHome });

export const indexQuery = (window: string) =>
    queryOptions({ queryKey: ['index', window], queryFn: () => fetchIndex(window) });

/** Disabled until `window` is known. */
export const groupQuery = (window: string | undefined, group: GroupId) =>
    queryOptions({
        queryKey: ['group', window, group],
        queryFn: window ? () => fetchGroup(window, group) : skipToken,
    });

export const groupSummaryQuery = (window: string | undefined, group: GroupId) =>
    queryOptions({
        queryKey: ['group-summary', window, group],
        queryFn: window ? () => fetchGroupSummary(window, group) : skipToken,
    });

export const carQuery = (window: string, group: GroupId, number: string) =>
    queryOptions({
        queryKey: ['car', window, group, number],
        queryFn: () => fetchCar(window, group, number),
    });

export const fleetsQuery = (group: GroupId) =>
    queryOptions({ queryKey: ['fleets', group], queryFn: () => fetchFleets(group) });

/** Disabled until `window` is known. */
export const routeQuery = (window: string | undefined, route: string) =>
    queryOptions({
        queryKey: ['route', window, route],
        queryFn: window ? () => fetchRoute(window, route) : skipToken,
    });

export const routeIndexQuery = (window: string) =>
    queryOptions({ queryKey: ['route-index', window], queryFn: () => fetchRouteIndex(window) });

export const useMeta = () => useQuery(metaQuery);

/** Season windows from meta, newest year first and last30 last (empty until meta loads). */
export function useWindows() {
    const meta = useMeta();

    const windows = useMemo(
        () => orderWindows(meta.data?.windows.map((w) => w.key) ?? []),
        [meta.data]
    );

    return { meta, windows };
}

export type Indexes = ReadonlyMap<string, IndexEntry[] | null | undefined>;

/**
 * Every window's index. With `enabled` false nothing is fetched, but anything already cached is
 * still returned. `indexes` keeps its identity until a query's data changes, so callers can memoize.
 */
export function useAllIndexes(enabled = true) {
    const { meta, windows } = useWindows();

    const combine = useCallback(
        (results: UseQueryResult<IndexEntry[] | null>[]) => ({
            indexes: new Map(windows.map((w, i) => [w, results[i]?.data])),
            pending: results.some((r) => r.isPending),
        }),
        [windows]
    );

    const { indexes, pending } = useQueries({
        queries: windows.map((w) => ({ ...indexQuery(w), enabled })),
        combine,
    });

    return {
        meta: meta.data,
        windows,
        indexes,
        // Pending while meta or any window's index is still loading (never for a disabled, empty query).
        loading: meta.isPending || (enabled && pending),
    };
}

export type RouteIndexes = ReadonlyMap<string, RouteIndexEntry[] | null | undefined>;

/** Every window's bus route list (a few KB each); `failed` holds the queries that errored, for a retry. */
export function useRouteIndexes(windows: string[]) {
    const combine = useCallback(
        (results: UseQueryResult<RouteIndexEntry[] | null>[]) => ({
            indexes: new Map(windows.map((w, i) => [w, results[i]?.data])),
            pending: results.some((r) => r.isPending),
            failed: results.filter((r) => r.isError),
        }),
        [windows]
    );

    return useQueries({ queries: windows.map(routeIndexQuery), combine });
}
