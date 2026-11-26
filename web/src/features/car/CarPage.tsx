import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import Loading from '../../components/Loading';
import ResourceView from '../../components/ResourceView';
import SeasonBar from '../../components/SeasonBar';
import { useDocumentTitle } from '../../components/useDocumentTitle';
import { GROUPS, type GroupId } from '../../groups';
import { groupSummaryQuery } from '../../queries';
import { CAREER, seasonLabel } from '../../seasons';
import { carTitle } from '../../titles';
import BioPanel from './BioPanel';
import CalendarPanel from './CalendarPanel';
import CarTabs from './CarTabs';
import PercentilePanel from './PercentilePanel';
import { noSeasonData } from './shared';
import { useCarData, type CarData } from './useCarData';

const route = getRouteApi('/car/$group/$number');

export default function CarPage() {
    const { group, number } = route.useParams();

    // A new car starts fresh (e.g. the game log collapses again).
    return <CarLoader key={`${group}/${number}`} group={group} number={number} />;
}

function CarLoader({ group, number }: { group: GroupId; number: string }) {
    const { season } = route.useSearch();
    const resource = useCarData(group, number, season);

    return (
        <ResourceView resource={resource}>
            {(data) => <CarView group={group} number={number} data={data} />}
        </ResourceView>
    );
}

function CarView({ group, number, data }: { group: GroupId; number: string; data: CarData }) {
    const { meta, career, options, season, seasonFile } = data;
    const car = seasonFile.status === 'ready' ? seasonFile.data : undefined;
    const allTime = season === CAREER;
    const { tab = 'log' } = route.useSearch();
    // The line's typical car only colors the calendar and game log, so the page doesn't wait for them.
    const { data: summary } = useQuery(groupSummaryQuery(season, group));
    const typical = summary?.typical?.travel_time_sec ?? null;
    const segs = summary?.segs_per_trip ?? null;

    useDocumentTitle(carTitle(group, number));

    return (
        <main>
            <SeasonBar
                latest={meta.latest_service_date}
                options={options}
                value={season}
                className="mt-2 mb-[34px]"
            />
            <div className="grid grid-cols-1 items-stretch gap-4 min-[761px]:grid-cols-2 min-[1180px]:grid-cols-3">
                <BioPanel group={group} number={number} season={season} career={career} car={car} />
                {car ? (
                    <>
                        <PercentilePanel
                            group={group}
                            season={season}
                            car={car}
                            summary={summary}
                        />
                        {allTime ? (
                            <AllTimeNote />
                        ) : (
                            <CalendarPanel
                                key={season}
                                season={season}
                                car={car}
                                typical={typical}
                                segs={segs}
                                window={meta.windows.find((w) => w.key === season)}
                                latest={meta.latest_service_date}
                            />
                        )}
                    </>
                ) : (
                    <SeasonNote>
                        {seasonFile.status === 'loading' ? (
                            <Loading inline />
                        ) : seasonFile.status === 'error' ? (
                            <>
                                <p role="alert" className="text-ink-2 text-lead m-0 mb-4">
                                    Couldn&rsquo;t load {seasonLabel(season)}.
                                </p>
                                <button
                                    type="button"
                                    onClick={seasonFile.retry}
                                    className="bg-brand text-ui cursor-pointer rounded-md border-0 px-5 py-2.5 text-white"
                                >
                                    Try again
                                </button>
                            </>
                        ) : (
                            <p className="text-ink-2 text-lead m-0">
                                {noSeasonData(GROUPS[group].noun, number, season)}
                            </p>
                        )}
                    </SeasonNote>
                )}
            </div>
            {car && !allTime && (
                <CarTabs
                    group={group}
                    season={season}
                    car={car}
                    typical={typical}
                    segs={segs}
                    tab={tab}
                />
            )}
        </main>
    );
}

/** The two season panels' place while the season loads, fails or has no data for this car. */
function SeasonNote({ children }: { children: ReactNode }) {
    return (
        <section className="panel grid place-items-center content-center p-8 text-center min-[1180px]:col-span-2">
            <div>{children}</div>
        </section>
    );
}

/** Stands in for the calendar on All-time, which has no single season's days to show. */
function AllTimeNote() {
    return (
        <section className="panel grid place-items-center p-8 text-center min-[761px]:max-[1179px]:col-span-2">
            <p className="text-ink-2 text-lead m-0">
                All-time combines every season, each compared with its own year. Pick a year for the
                day-by-day log.
            </p>
        </section>
    );
}
