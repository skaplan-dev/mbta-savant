import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { Car, CareerCar, Meta } from '../../api';
import type { GroupId } from '../../groups';
import { carQuery, careerQuery, useWindows } from '../../queries';
import { failure, type Resource } from '../../resource';
import { CAREER, isYearKey, LAST30, orderWindows, resolveSeason } from '../../seasons';

export interface CarData {
    meta: Meta;
    /** The All-time record: bio (fresh roster, so Retired shows on every season) and season history. */
    career: CareerCar;
    /** The seasons this car has data for, toggle order (All-time, years newest first, last30). */
    options: string[];
    season: string;
    /**
     * The record for `season` (the career record on All-time), loaded on its own so a season switch
     * keeps the bio, season bar and history on screen; `missing` when the car has no data that season.
     * It is always the file for `season`, never the previous season's while the new one loads.
     */
    seasonFile: Resource<Car>;
}

/** The car ran in the last-30-days window: its last service day is inside it (it then has a file there). */
function ranLast30(meta: Meta, career: CareerCar): boolean {
    const window = meta.windows.find((w) => w.key === LAST30);

    return !!window && !!career.last_seen && career.last_seen >= window.start;
}

/**
 * Loads meta, the car's career file and the selected season's file only. The season options come
 * from the career file; the default is the newest year where the car was ranked, else its newest
 * year, else last30.
 */
export function useCarData(
    group: GroupId,
    number: string,
    requested: string | undefined
): Resource<CarData> {
    const { meta, windows } = useWindows();
    const careerResult = useQuery(careerQuery(group, number));
    const career = careerResult.data;

    let options: string[] = [];
    let season: string | undefined;

    if (meta.data && career) {
        options = orderWindows([
            CAREER,
            ...career.windows,
            ...(ranLast30(meta.data, career) ? [LAST30] : []),
        ]);

        const ranked = (w: string) =>
            career.seasons.some((s) => s.season === w && s.qualified && s.ranked);

        // A requested window the site has (even one this car has no data for) wins, so the page can say so.
        season = resolveSeason(
            requested,
            [...new Set([...windows, ...options])],
            (w) => options.includes(w) && isYearKey(w) && ranked(w),
            (w) => options.includes(w) && isYearKey(w),
            (w) => options.includes(w) && w === LAST30
        );
    }

    // All-time is the career record itself; only a year or last30 needs its own file.
    const needsFile = season !== undefined && season !== CAREER;
    const seasonResult = useQuery({ ...carQuery(season, group, number), enabled: needsFile });

    if (meta.isPending || careerResult.isPending) return { status: 'loading' };

    const failed = failure(meta, careerResult);

    if (failed) return failed;

    if (!meta.data || !career || season === undefined) return { status: 'missing' };

    return {
        status: 'ready',
        data: {
            meta: meta.data,
            career,
            options,
            season,
            seasonFile: needsFile ? toResource(seasonResult) : { status: 'ready', data: career },
        },
    };
}

/** One season file's query as a resource; a 404 (null) is `missing`. */
function toResource(q: UseQueryResult<Car | null>): Resource<Car> {
    if (q.isPending) return { status: 'loading' };

    const failed = failure(q);

    if (failed) return failed;

    return q.data ? { status: 'ready', data: q.data } : { status: 'missing' };
}
