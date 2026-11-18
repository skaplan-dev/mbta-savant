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
}

/** Loads meta and every window's file for one car; undefined while loading. */
export function useCarData(
    group: string,
    number: string,
    requested: string | undefined
): CarData | undefined {
    const { data: meta, isPending: metaPending } = useMeta();
    const keys = meta ? orderWindows(meta.windows.map((w) => w.key)) : [];
    const results = useQueries({
        queries: keys.map((w) => ({
            queryKey: ['car', w, group, number],
            queryFn: () => fetchCar(w, group, number),
            staleTime: 60 * 60 * 1000,
        })),
    });
    if (metaPending || results.some((r) => r.isPending)) return undefined;
    if (!meta)
        return {
            meta: { generated_at: '', windows: [], latest_service_date: null },
            cars: {},
            available: [],
            season: undefined,
        };
    const cars: Record<string, Car | null> = {};
    keys.forEach((k, i) => (cars[k] = results[i].data ?? null));
    return {
        meta,
        cars,
        available: keys.filter((k) => cars[k]),
        season: resolveSeason(requested, keys, cars),
    };
}
