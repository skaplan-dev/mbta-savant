import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import type { HomeCard } from '../../api';
import CarPill from '../../components/CarPill';
import DateBox from '../../components/DateBox';
import Loading from '../../components/Loading';
import Search from '../../components/Search';
import SectionHeading from '../../components/SectionHeading';
import { useDocumentTitle } from '../../components/useDocumentTitle';
import { fmtTrips, pctColor, tint } from '../../format';
import { GROUP_IDS, GROUPS, type GroupId } from '../../groups';
import { homeQuery, useMeta } from '../../queries';
import { UNRANKED_LINE_NOTE } from '../../rank';
import { seasonLabel } from '../../seasons';
import { HOME_TITLE } from '../../titles';

export default function HomePage() {
    useDocumentTitle(HOME_TITLE);
    const { data: meta } = useMeta();
    // Each card is in its line's default season, the same one the leaderboard it links to opens on.
    const home = useQuery(homeQuery);

    return (
        <main>
            <section className="py-10 text-center md:py-14">
                <h1 className="text-display m-0 font-medium">
                    Every MBTA train car and bus, with a stat line.
                </h1>
                <p className="text-ink-2 text-lead mx-auto mt-3 mb-7 max-w-[60ch]">
                    Built nightly from the T’s own arrival and departure records: find a car, see
                    how it ranks against its line.
                </p>
                <div className="[&_input]:text-subsection mx-auto max-w-[720px] text-left [&_input]:h-16">
                    <Search />
                </div>
                <div className="mt-7 flex justify-center">
                    <DateBox latest={meta?.latest_service_date ?? null} />
                </div>
            </section>
            <section aria-labelledby="leaders-h" className="pb-10">
                <SectionHeading id="leaders-h" className="m-0 mb-4">
                    Line Leaders
                    <span className="text-ink-3 text-lead ml-3 font-normal">top 5 by TAR</span>
                </SectionHeading>
                {home.isPending ? (
                    <Loading inline />
                ) : (
                    <div className="grid grid-cols-1 gap-4 min-[761px]:grid-cols-2 min-[1180px]:grid-cols-3">
                        {GROUP_IDS.map((group) => {
                            const card = home.data?.[group];

                            return card && <LeaderCard key={group} group={group} card={card} />;
                        })}
                    </div>
                )}
            </section>
        </main>
    );
}

function LeaderCard({
    group,
    card: { season, leaders, cars },
}: {
    group: GroupId;
    card: HomeCard;
}) {
    const g = GROUPS[group];

    return (
        <section className="panel flex flex-col" aria-label={`${g.name} leaders`}>
            <h3
                className={`text-subsection m-0 flex items-baseline justify-between px-4 py-2.5 font-medium ${g.onColor}`}
                style={{ background: g.color }}
            >
                <Link
                    to="/line/$group"
                    params={{ group }}
                    search={{ season }}
                    className="text-inherit no-underline hover:underline"
                >
                    {g.name}
                </Link>
                <span className="text-ui font-normal">{seasonLabel(season)}</span>
            </h3>
            <div className="flex-1 px-4 py-2">
                {leaders.length > 0 ? (
                    <ol className="m-0 list-none p-0">
                        {leaders.map((e, i) => (
                            <li
                                key={e.car_id}
                                className="border-row-rule text-lead flex items-center gap-3 border-b border-dashed py-2 last:border-b-0"
                            >
                                <span className="text-ink-3 text-ui w-4">{i + 1}</span>
                                <CarPill group={group} number={e.number} season={season} />
                                <span
                                    className="text-ink-2 text-meta min-w-0 flex-1 truncate"
                                    title={e.fleet_label}
                                >
                                    {e.fleet_label}
                                </span>
                                <span
                                    className="rounded px-2 py-0.5 font-medium"
                                    style={
                                        e.pct_tar == null
                                            ? undefined
                                            : { background: tint(pctColor(e.pct_tar)) }
                                    }
                                >
                                    {fmtTrips(e.tar)}
                                </span>
                            </li>
                        ))}
                    </ol>
                ) : (
                    <div className="py-2">
                        <p className="text-lead m-0 mb-2 font-medium">Not ranked</p>
                        <p className="text-ink-2 text-ui m-0 mb-3">
                            {g.ranked ? 'No qualified cars yet.' : UNRANKED_LINE_NOTE}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {cars.map((number) => (
                                <CarPill
                                    key={number}
                                    group={group}
                                    number={number}
                                    season={season}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
            <Link
                to="/line/$group"
                params={{ group }}
                search={{ season }}
                className="text-brand border-panel-line text-ui border-t px-4 py-2.5"
            >
                {leaders.length ? 'Full leaderboard' : 'See the cars'}{' '}
                <ArrowRight className="inline size-[1em] align-[-0.125em]" strokeWidth={2.5} />
            </Link>
        </section>
    );
}
