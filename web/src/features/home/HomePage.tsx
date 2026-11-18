import { Link } from '@tanstack/react-router';
import type { IndexEntry } from '../../api';
import CarPill, { tint } from '../../components/CarPill';
import DateBox from '../../components/DateBox';
import Search from '../../components/Search';
import { GROUP_IDS, GROUPS, pctColor, seasonLabel, signed, type GroupId } from '../../format';
import { defaultWindow, useIndex, useMeta } from '../../queries';
import { groupCars, topLeaders } from './leaders';

export default function HomePage() {
    const { data: meta } = useMeta();
    const win = defaultWindow(meta);
    const { data: index, isPending } = useIndex(win);
    // Lines with no ranked cars in the newest year (early in a season) fall back to last 30 days.
    const needFallback =
        !!index && GROUP_IDS.some((g) => g !== 'mattapan' && topLeaders(index, g, 1).length === 0);
    const { data: recent } = useIndex(needFallback ? 'last30' : undefined);

    return (
        <main>
            <section className="py-10 text-center md:py-14">
                <h1 className="m-0 text-[34px] font-medium tracking-tight md:text-[52px]">
                    Every MBTA train car and bus, with a stat line.
                </h1>
                <p className="text-ink-2 mx-auto mt-3 mb-7 max-w-[60ch] text-xl md:text-[22px]">
                    Built nightly from the T’s own arrival and departure records: find a car, see
                    how it ranks against its line.
                </p>
                <div className="mx-auto max-w-[720px] text-left [&_input]:h-16 [&_input]:text-2xl">
                    <Search label="Search a car or bus number" />
                </div>
                <div className="mt-7 flex justify-center">
                    <DateBox latest={meta?.latest_service_date} />
                </div>
            </section>
            <section aria-labelledby="leaders-h" className="pb-10">
                <h2
                    id="leaders-h"
                    className="border-brand-2 m-0 mb-4 border-b pb-2 text-[30px] font-bold"
                >
                    Line Leaders
                    <span className="text-ink-3 ml-3 text-xl font-light">
                        top 5 by Time Saved
                        {win ? ` · ${seasonLabel(win)}` : ''}
                    </span>
                </h2>
                {isPending && win ? (
                    <p className="text-ink-2 text-xl">Loading…</p>
                ) : (
                    <div className="grid grid-cols-1 gap-4 min-[761px]:grid-cols-2 min-[1180px]:grid-cols-3">
                        {GROUP_IDS.map((g) => {
                            const fromYear = index ? topLeaders(index, g) : [];
                            const useRecent = fromYear.length === 0 && recent;
                            const rows = useRecent ? topLeaders(recent, g) : fromYear;
                            const all = groupCars(index ?? [], g);
                            return (
                                <LeaderCard
                                    key={g}
                                    group={g}
                                    rows={rows}
                                    season={useRecent && rows.length ? 'last30' : undefined}
                                    cars={all.length ? all : groupCars(recent ?? [], g)}
                                />
                            );
                        })}
                    </div>
                )}
            </section>
        </main>
    );
}

function LeaderCard({
    group,
    rows,
    cars,
    season,
}: {
    group: GroupId;
    rows: IndexEntry[];
    cars: IndexEntry[];
    season: string | undefined;
}) {
    const g = GROUPS[group];
    return (
        <section className="panel flex flex-col" aria-label={`${g.name} leaders`}>
            <h3
                className={`m-0 flex items-baseline justify-between px-4 py-2.5 text-[26px] font-medium ${group === 'bus' ? 'text-ink' : 'text-white'}`}
                style={{ background: g.color }}
            >
                <Link
                    to="/line/$group"
                    params={{ group }}
                    search={season ? { season } : {}}
                    className="text-inherit no-underline hover:underline"
                >
                    {g.name}
                </Link>
                {season && <span className="text-base font-light">last 30 days</span>}
            </h3>
            <div className="flex-1 px-4 py-2">
                {rows.length > 0 ? (
                    <ol className="m-0 list-none p-0">
                        {rows.map((e, i) => (
                            <li
                                key={e.car_id}
                                className="flex items-center gap-3 border-b border-dashed border-[#d6e1e4] py-2 text-xl last:border-b-0"
                            >
                                <span className="text-ink-3 w-4 text-lg">{i + 1}</span>
                                <CarPill group={group} number={e.number} season={season} />
                                <span className="text-ink-2 min-w-0 flex-1 truncate text-base">
                                    {e.fleet_label}
                                </span>
                                <span
                                    className="rounded px-2 py-0.5 font-medium"
                                    style={
                                        e.pct_ttoe == null
                                            ? undefined
                                            : { background: tint(pctColor(e.pct_ttoe)) }
                                    }
                                >
                                    {signed(-e.ttoe_vs_avg_sec!, 1, ' s')}
                                </span>
                            </li>
                        ))}
                    </ol>
                ) : (
                    <div className="py-2">
                        <p className="m-0 mb-2 text-xl font-medium">Not ranked</p>
                        <p className="text-ink-2 m-0 mb-3 text-base">
                            {group === 'mattapan'
                                ? 'Mattapan’s handful of trolleys get stats but aren’t ranked.'
                                : 'No qualified cars yet.'}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {cars.map((e) => (
                                <CarPill key={e.car_id} group={group} number={e.number} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
            <Link
                to="/line/$group"
                params={{ group }}
                search={season ? { season } : {}}
                className="text-brand border-panel-line border-t px-4 py-2.5 text-lg"
            >
                {rows.length ? 'Full leaderboard' : 'See the cars'} &rarr;
            </Link>
        </section>
    );
}
