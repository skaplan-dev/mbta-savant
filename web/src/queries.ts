import { useQuery } from '@tanstack/react-query';
import { fetchCar, fetchFleets, fetchGroup, fetchIndex, fetchMeta, type Meta } from './api';

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
        staleTime,
    });

export const useCar = (window: string, group: string, number: string) =>
    useQuery({
        queryKey: ['car', window, group, number],
        queryFn: () => fetchCar(window, group, number),
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
