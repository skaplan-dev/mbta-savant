import { getRouteApi, Link } from '@tanstack/react-router';
import { useMemo } from 'react';
import { routeLabel } from '../../busRoutes';
import LineDot from '../../components/LineDot';
import ResourceView from '../../components/ResourceView';
import SeasonBar from '../../components/SeasonBar';
import { useDocumentTitle } from '../../components/useDocumentTitle';
import { fmtInt } from '../../format';
import { seasonLabel } from '../../seasons';
import { routeBoardStats } from '../../stats';
import { routeTitle } from '../../titles';
import LeaderboardTable from '../line/LeaderboardTable';
import { splitCars } from '../line/leaderboard';
import NotRanked from '../line/NotRanked';
import { useRouteData, type RouteData } from './useRouteData';

const page = getRouteApi('/route/$route');

const COLS = routeBoardStats();

export default function RoutePage() {
    const { route } = page.useParams();

    return <RouteLoader key={route} route={route} />;
}

function RouteLoader({ route }: { route: string }) {
    const { season } = page.useSearch();
    const resource = useRouteData(route, season);

    return (
        <ResourceView resource={resource}>
            {(data) => <RouteView route={route} data={data} />}
        </ResourceView>
    );
}

function RouteView({
    route,
    data: { meta, options, season, file },
}: {
    route: string;
    data: RouteData;
}) {
    const label = routeLabel(route);
    const min = fmtInt(file.qualify_min_trips);

    const { ranked, unranked } = useMemo(() => {
        const split = splitCars('bus', file);

        return {
            ranked: split.ranked,
            // Every roster bus here missed the same bar, so say it in route terms.
            unranked: split.unranked.map((u) =>
                u.car.ranked ? { ...u, reason: `needs ${min} on this route` } : u
            ),
        };
    }, [file, min]);

    useDocumentTitle(routeTitle(season, route));

    return (
        <main>
            <SeasonBar
                latest={meta.latest_service_date}
                options={options}
                value={season}
                className="mt-2 mb-[26px]"
            />
            <h1 className="text-title m-0 font-medium">
                <LineDot group="bus" className="mr-3 inline-block size-[18px] align-middle" />
                {seasonLabel(season)} Route {label} Leaderboard
            </h1>
            <p className="text-ink-2 text-ui md:text-lead mt-1.5 mb-6">
                {ranked.length > 0
                    ? `${fmtInt(ranked.length)} ranked buses, each compared only with other buses on Route ${label}, using just its trips on this route. Buses need ${min} trips here to qualify.`
                    : `No bus ran Route ${label} enough this season to be ranked (it takes ${min} trips).`}{' '}
                <Link
                    to="/line/$group"
                    params={{ group: 'bus' }}
                    search={{ season }}
                    className="text-brand whitespace-nowrap"
                >
                    See all buses
                </Link>
            </p>
            {ranked.length > 0 && (
                <LeaderboardTable
                    group="bus"
                    season={season}
                    ranked={ranked}
                    cols={COLS}
                    scope="route"
                />
            )}
            {unranked.length > 0 && <NotRanked group="bus" season={season} rows={unranked} />}
        </main>
    );
}
