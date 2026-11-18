import { useQueries } from '@tanstack/react-query';
import { fetchCar, type Car, type Meta } from '../../api';
import { useMeta } from '../../queries';
import { orderWindows, resolveSeason } from './season';

export interface CarData {
    meta: Meta;
    /** window → this car's file (null when missing). */
    cars: Record<string, Car | null>;
    /** Windows where the car has a file, toggle order. */
    available: string[];
    season: string | undefined;
    /** A request failed (network or parse error); distinct from a car that has no file. */
    failed: boolean;
    retry: () => void;
}

/** Loads meta and every window's file for one car; undefined while loading. */
export function useCarData(
    group: string,
    number: string,
    requested: string | undefined
): CarData | undefined {
    const metaResult = useMeta();
    const { data: meta, isPending: metaPending } = metaResult;
    const keys = meta ? orderWindows(meta.windows.map((w) => w.key)) : [];
    const results = useQueries({
        queries: keys.map((w) => ({
            queryKey: ['car', w, group, number],
            queryFn: () => fetchCar(w, group, number),
            staleTime: 60 * 60 * 1000,
        })),
    });
    if (metaPending || results.some((r) => r.isPending)) return undefined;
    const failed = results.some((r) => r.isError) || metaResult.isError;
    const retry = () => {
        if (metaResult.isError) void metaResult.refetch();
        results.forEach((r) => r.isError && void r.refetch());
    };
    if (!meta)
        return {
            meta: { generated_at: '', windows: [], latest_service_date: null },
            cars: {},
            available: [],
            season: undefined,
            failed,
            retry,
        };
    const cars: Record<string, Car | null> = {};
    keys.forEach((k, i) => (cars[k] = results[i].data ?? null));
    return {
        meta,
        cars,
        available: keys.filter((k) => cars[k]),
        season: resolveSeason(requested, keys, cars),
        failed,
        retry,
    };
}
