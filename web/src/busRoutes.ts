import type { RouteIndexEntry } from './api';
import { compareNumeric } from './compare';
import { CAREER, isYearKey, LAST30, resolveSeason } from './seasons';

// GTFS route ids for the Silver Line, which riders know by name.
const SILVER_LINE: Readonly<Record<string, string>> = {
    '741': 'SL1',
    '742': 'SL2',
    '743': 'SL3',
    '746': 'SLW',
    '749': 'SL5',
    '751': 'SL4',
};

/** How a bus route is shown: "SL1" for 741, otherwise the route id as is. */
export const routeLabel = (route: string): string => SILVER_LINE[route] ?? route;

type Indexes = ReadonlyMap<string, readonly RouteIndexEntry[] | null | undefined>;

const entry = (indexes: Indexes, window: string, route: string) =>
    indexes.get(window)?.find((e) => e.route === route);

/** The windows (in toggle order) in which the route ran; no route boards exist for career. */
export const routeWindows = (route: string, windows: readonly string[], indexes: Indexes) =>
    windows.filter((w) => w !== CAREER && entry(indexes, w, route));

/**
 * A route's season: the requested one if the route ran then, else the newest year with a ranked bus
 * on it, else last30, else the first window it ran in.
 */
export const routeSeason = (
    route: string,
    requested: string | undefined,
    options: readonly string[],
    indexes: Indexes
): string | undefined =>
    resolveSeason(
        requested,
        options,
        (w) => isYearKey(w) && (entry(indexes, w, route)?.ranked_cars ?? 0) > 0,
        (w) => w === LAST30,
        () => true
    );

/** Routes in numeric order ("SL" routes by name), filtered to those whose id or name starts with `term`. */
export function matchRoutes(routes: readonly RouteIndexEntry[], term: string): RouteIndexEntry[] {
    const t = term.toUpperCase();

    return routes
        .filter(
            (r) => !t || r.route.toUpperCase().startsWith(t) || routeLabel(r.route).startsWith(t)
        )
        .sort((a, b) => compareNumeric(routeLabel(a.route), routeLabel(b.route)));
}
