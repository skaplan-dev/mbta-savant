import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import ResourceView from '../../components/ResourceView';
import SeasonBar from '../../components/SeasonBar';
import { useDocumentTitle } from '../../components/useDocumentTitle';
import { GROUPS, type GroupId } from '../../groups';
import { groupSummaryQuery } from '../../queries';
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
    const { meta, files, season, car } = data;
    const { tab = 'log' } = route.useSearch();
    // The line's typical car only colors the calendar and game log, so the page doesn't wait for them.
    const { data: summary } = useQuery(groupSummaryQuery(season, group));
    const typical = summary?.typical?.trip_time_sec ?? null;
    const segs = summary?.segs_per_trip ?? null;

    useDocumentTitle(carTitle(group, number));

    return (
        <main>
            <SeasonBar
                latest={meta.latest_service_date}
                options={files.map((f) => f.window)}
                value={season}
                className="mt-2 mb-[34px]"
            />
            <div className="grid grid-cols-1 items-stretch gap-4 min-[761px]:grid-cols-2 min-[1180px]:grid-cols-3">
                <BioPanel
                    group={group}
                    number={number}
                    season={season}
                    car={data.bio}
                    files={files}
                />
                {car ? (
                    <>
                        <PercentilePanel
                            group={group}
                            season={season}
                            car={car}
                            summary={summary}
                        />
                        <CalendarPanel
                            key={season}
                            season={season}
                            car={car}
                            typical={typical}
                            segs={segs}
                            window={meta.windows.find((w) => w.key === season)}
                            latest={meta.latest_service_date}
                        />
                    </>
                ) : (
                    <section className="panel grid place-items-center p-8 text-center min-[1180px]:col-span-2">
                        <p className="text-ink-2 text-lead m-0">
                            {noSeasonData(GROUPS[group].noun, number, season)}
                        </p>
                    </section>
                )}
            </div>
            {car && (
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
