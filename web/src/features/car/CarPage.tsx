import { useState } from 'react';
import LoadError from '../../components/LoadError';
import DateBox from '../../components/DateBox';
import NotFound from '../../components/NotFound';
import SeasonToggle from '../../components/SeasonToggle';
import { useDocumentTitle } from '../../components/useDocumentTitle';
import { GROUPS, seasonLabel, type GroupId } from '../../format';
import { carTitle } from '../../titles';
import { useGroup } from '../../queries';
import BioPanel from './BioPanel';
import CalendarPanel from './CalendarPanel';
import CarTabs, { type TabId } from './GameLog';
import PercentilePanel from './PercentilePanel';
import { useCarData } from './useCarData';

export default function CarPage({
    group,
    number,
    season: requested,
}: {
    group: GroupId;
    number: string;
    season: string | undefined;
}) {
    const data = useCarData(group, number, requested);
    const [tab, setTab] = useState<TabId>('log');
    const season = data?.season;
    const { data: groupFile } = useGroup(season ?? '', group);

    const found = !!data && !data.failed && !!season && data.available.length > 0;
    // NotFound sets its own title.
    useDocumentTitle(found ? carTitle(group, number) : undefined);

    if (!data) return <p className="text-ink-2 py-16 text-center text-xl">Loading…</p>;
    if (data.failed) return <LoadError onRetry={data.retry} />;
    if (!season || !data.available.length) return <NotFound />;

    const car = data.cars[season];
    const years = data.available.filter((k) => k !== 'last30');
    const avg = groupFile?.averages.ttoe_sec ?? null;
    // Bio and season table come from the newest file the car has, even when the selected season is empty.
    const bioCar = car ?? data.cars[data.available[0]]!;

    return (
        <>
            <div className="mt-2 mb-[34px] flex flex-col justify-between gap-4 md:flex-row md:items-stretch">
                <DateBox latest={data.meta.latest_service_date} />
                <SeasonToggle options={data.available} value={season} />
            </div>
            <main className="grid grid-cols-1 items-stretch gap-4 min-[761px]:grid-cols-2 min-[1180px]:grid-cols-3">
                <BioPanel
                    group={group}
                    number={number}
                    season={season}
                    hasSeasonData={!!car}
                    car={bioCar}
                    cars={data.cars}
                    years={years}
                    onTab={setTab}
                />
                {car ? (
                    <>
                        <PercentilePanel
                            group={group}
                            season={season}
                            car={car}
                            groupFile={groupFile}
                        />
                        <CalendarPanel
                            season={season}
                            car={car}
                            avg={avg}
                            window={data.meta.windows.find((w) => w.key === season)}
                            latest={data.meta.latest_service_date}
                        />
                    </>
                ) : (
                    <section className="panel grid place-items-center p-8 text-center min-[1180px]:col-span-2">
                        <p className="text-ink-2 m-0 text-xl">
                            {group === 'bus' ? 'Bus' : 'Car'} {number} has no {GROUPS[group].name}{' '}
                            data for {seasonLabel(season)}. Pick another season above.
                        </p>
                    </section>
                )}
            </main>
            {car && (
                <CarTabs
                    group={group}
                    season={season}
                    car={car}
                    avg={avg}
                    tab={tab}
                    onTab={setTab}
                />
            )}
        </>
    );
}
