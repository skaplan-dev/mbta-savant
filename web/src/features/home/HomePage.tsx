import { Link } from '@tanstack/react-router';
import { useMemo } from 'react';
import type { IndexEntry } from '../../api';
import CarPill from '../../components/CarPill';
import DateBox from '../../components/DateBox';
import Loading from '../../components/Loading';
import Search from '../../components/Search';
import SectionHeading from '../../components/SectionHeading';
import { useDocumentTitle } from '../../components/useDocumentTitle';
import { byNumber } from '../../compare';
import { fmtSaved, pctColor, timeSaved, tint } from '../../format';
import { GROUP_IDS, GROUPS, type GroupId } from '../../groups';
import { useAllIndexes } from '../../queries';
import { lineSeason, UNRANKED_LINE_NOTE } from '../../rank';
import { seasonLabel } from '../../seasons';
import { HOME_TITLE } from '../../titles';
import { topLeaders } from './leaders';

interface LineCard {
    group: GroupId;
    season: string;
    /** The group's entries in `season`. */
    entries: IndexEntry[];
}

export default function HomePage() {
    useDocumentTitle(HOME_TITLE);
    const { meta, windows, indexes, loading } = useAllIndexes();

    // Each card uses its line's default season, the same rule as the leaderboard it links to.
    const cards = useMemo(
        (): LineCard[] =>
            GROUP_IDS.map((group) => {
                const season = lineSeason(group, undefined, windows, indexes);
                const entries = (indexes.get(season) ?? []).filter((e) => e.group === group);

                return { group, season, entries };
            }),
        [windows, indexes]
    );

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
                    <Search />
                </div>
                <div className="mt-7 flex justify-center">
                    <DateBox latest={meta?.latest_service_date ?? null} />
                </div>
            </section>
            <section aria-labelledby="leaders-h" className="pb-10">
                <SectionHeading id="leaders-h" className="m-0 mb-4 text-[30px]">
                    Line Leaders
                    <span className="text-ink-3 ml-3 text-xl font-light">top 5 by Time Saved</span>
                </SectionHeading>
                {loading ? (
                    <Loading inline />
                ) : (
                    <div className="grid grid-cols-1 gap-4 min-[761px]:grid-cols-2 min-[1180px]:grid-cols-3">
                        {cards.map((c) => (
                            <LeaderCard key={c.group} {...c} />
                        ))}
                    </div>
                )}
            </section>
        </main>
    );
}

function LeaderCard({ group, season, entries }: LineCard) {
    const g = GROUPS[group];
    const leaders = topLeaders(entries);

    return (
        <section className="panel flex flex-col" aria-label={`${g.name} leaders`}>
            <h3
                className={`m-0 flex items-baseline justify-between px-4 py-2.5 text-[26px] font-medium ${g.onColor}`}
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
                <span className="text-base font-light">{seasonLabel(season)}</span>
            </h3>
            <div className="flex-1 px-4 py-2">
                {leaders.length > 0 ? (
                    <ol className="m-0 list-none p-0">
                        {leaders.map((e, i) => (
                            <li
                                key={e.car_id}
                                className="border-row-rule flex items-center gap-3 border-b border-dashed py-2 text-xl last:border-b-0"
                            >
                                <span className="text-ink-3 w-4 text-lg">{i + 1}</span>
                                <CarPill group={group} number={e.number} season={season} />
                                <span
                                    className="text-ink-2 min-w-0 flex-1 truncate text-base"
                                    title={e.fleet_label}
                                >
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
                                    {fmtSaved(timeSaved(e))}
                                </span>
                            </li>
                        ))}
                    </ol>
                ) : (
                    <div className="py-2">
                        <p className="m-0 mb-2 text-xl font-medium">Not ranked</p>
                        <p className="text-ink-2 m-0 mb-3 text-base">
                            {g.ranked ? 'No qualified cars yet.' : UNRANKED_LINE_NOTE}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {[...entries].sort(byNumber).map((e) => (
                                <CarPill
                                    key={e.car_id}
                                    group={group}
                                    number={e.number}
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
                className="text-brand border-panel-line border-t px-4 py-2.5 text-lg"
            >
                {leaders.length ? 'Full leaderboard' : 'See the cars'} &rarr;
            </Link>
        </section>
    );
}
