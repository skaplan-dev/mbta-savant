import { useQuery } from '@tanstack/react-query';
import type { Meta, RouteFile } from '../../api';
import { routeSeason, routeWindows } from '../../busRoutes';
import { routeQuery, useRouteIndexes, useWindows } from '../../queries';
import { failure, type Resource } from '../../resource';

export interface RouteData {
    meta: Meta;
    /** Windows the route ran in, toggle order. */
    options: string[];
    season: string;
    file: RouteFile;
}

export function useRouteData(route: string, requested: string | undefined): Resource<RouteData> {
    const { meta, windows } = useWindows();
    const all = useRouteIndexes(windows);
    const options = routeWindows(route, windows, all.indexes);

    const season =
        meta.data && !all.pending ? routeSeason(route, requested, options, all.indexes) : undefined;

    const file = useQuery(routeQuery(season, route));

    if (meta.isPending || all.pending || (season && file.isPending)) return { status: 'loading' };

    const failed = failure(meta, ...all.failed, file);

    if (failed) return failed;

    // A route that never ran in any window, or a file missing for its season.
    if (!meta.data || !season || !file.data) return { status: 'missing' };

    return { status: 'ready', data: { meta: meta.data, options, season, file: file.data } };
}
