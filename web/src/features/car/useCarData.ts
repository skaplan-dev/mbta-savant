import { useQueries } from '@tanstack/react-query';
import type { Car, Meta } from '../../api';
import type { GroupId } from '../../groups';
import { carQuery, useWindows } from '../../queries';
import { failure, type Resource } from '../../resource';
import { CAREER, isYearKey, resolveSeason } from '../../seasons';

export interface CarFile {
    window: string;
    car: Car;
}

export interface CarData {
    meta: Meta;
    /** The windows this car has a file for, toggle order (newest year first, last30 last). */
    files: CarFile[];
    season: string;
    /** The file for `season`; absent when a requested season has no data for this car. */
    car: Car | undefined;
    /** Bio and season table come from the newest file, even when the selected season is empty. */
    bio: Car;
}

/**
 * Loads meta and every window's file for one car; all are needed for the season toggle and table.
 * The default season is the newest year where the car was ranked, else its newest file.
 */
export function useCarData(
    group: GroupId,
    number: string,
    requested: string | undefined
): Resource<CarData> {
    const { meta, windows } = useWindows();
    const results = useQueries({ queries: windows.map((w) => carQuery(w, group, number)) });

    if (meta.isPending || results.some((r) => r.isPending)) return { status: 'loading' };

    const failed = failure(meta, ...results);

    if (failed) return failed;

    const files = windows.flatMap((window, i) => {
        const car = results[i]?.data;

        return car ? [{ window, car }] : [];
    });

    const [newest] = files;

    if (!meta.data || !newest) return { status: 'missing' };

    const season =
        resolveSeason(requested, windows, (w) =>
            files.some((f) => f.window === w && isYearKey(w) && f.car.qualified && f.car.ranked)
        ) ?? (files.find((f) => f.window !== CAREER) ?? newest).window;

    const car = files.find((f) => f.window === season)?.car;

    return {
        status: 'ready',
        data: { meta: meta.data, files, season, car, bio: car ?? newest.car },
    };
}
