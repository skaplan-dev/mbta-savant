import { Link } from '@tanstack/react-router';
import { ArrowRight, Gauge, TrainTrack, type LucideIcon } from 'lucide-react';
import type { Car, GroupSummary } from '../../api';
import PanelHeader from '../../components/PanelHeader';
import PercentileBar from '../../components/PercentileBar';
import StatTerm from '../../components/StatTerm';
import { barPos, fmtInt, fmtNum } from '../../format';
import { GLOSSARY } from '../../glossary';
import { GROUPS, type GroupId } from '../../groups';
import { isRanked, unrankedReason } from '../../rank';
import { panelStats, type Stat } from '../../stats';

const COLS = 'grid grid-cols-[32%_minmax(0,1fr)_72px]';
const ROW_RULE = 'border-t border-dashed border-row-rule';

const SCALE = [
    ['POOR', 'text-poor', barPos(0)],
    ['AVERAGE', 'text-ink-3', 50],
    ['GREAT', 'text-great', barPos(100)],
] as const;

function Section({
    Icon,
    title,
    stats,
    car,
    ranked,
    first = false,
}: {
    Icon: LucideIcon;
    title: string;
    stats: Stat[];
    car: Car;
    ranked: boolean;
    first?: boolean;
}) {
    return (
        <>
            <div
                className={`border-brand-2 flex items-end gap-2.5 border-b-2 pb-1.5 ${first ? 'mt-2.5' : 'mt-[22px]'}`}
            >
                <Icon className="size-10" strokeWidth={2} />
                <h3 className="text-lead m-0 font-bold">{title}</h3>
            </div>
            <div className={`${COLS} text-ui mt-3 mb-0.5`} aria-hidden="true">
                <div className="col-start-2 mx-2">
                    <div className="text-meta flex justify-between">
                        {SCALE.map(([t, c]) => (
                            <span
                                key={t}
                                className={`${c} ${t === 'AVERAGE' ? 'max-sm:invisible' : ''}`}
                            >
                                {t}
                            </span>
                        ))}
                    </div>
                    <div className="relative h-2">
                        {SCALE.map(([t, c, at]) => (
                            <span
                                key={t}
                                className={`absolute -translate-x-1/2 border-x-[6px] border-b-[6px] border-x-transparent border-b-current ${c}`}
                                style={{ left: `${at}%` }}
                            />
                        ))}
                    </div>
                </div>
            </div>
            {stats.map((s, i) => (
                <div key={s.id} className={`${COLS} items-stretch`}>
                    <div
                        className={`text-meta text-ink-2 flex items-center justify-end pr-2.5 text-right leading-tight ${i ? ROW_RULE : ''}`}
                    >
                        <StatTerm id={s.id} />
                    </div>
                    <PercentileBar
                        pct={ranked ? car.pct[s.pct] : null}
                        label={GLOSSARY[s.id].name}
                    />
                    <div
                        className={`text-meta text-ink-2 flex items-center justify-end text-right leading-tight ${i ? ROW_RULE : ''}`}
                    >
                        {(s.brief ?? s.text)(car)}
                    </div>
                </div>
            ))}
        </>
    );
}

export default function PercentilePanel({
    group,
    season,
    car,
    summary,
}: {
    group: GroupId;
    season: string;
    car: Car;
    summary: GroupSummary | null | undefined;
}) {
    const info = GROUPS[group];
    const ranked = isRanked(group, car);
    const rankedCount = summary?.ranked_cars;

    const rankedNote =
        ranked && rankedCount ? `Ranked against ${rankedCount} qualified ${info.pool}.` : null;

    // Why there are no bubbles is the first thing to say, so it goes above the numbers. A line that is
    // never ranked has no average to compare against, which is why those rows are dashes.
    const reason = ranked ? null : unrankedReason(group, car, summary?.qualify_min_trips);

    const unrankedNote =
        reason && !info.ranked
            ? `${reason} Time Saved, Pace+ and Door Time compare a car with its line’s average, so they aren’t shown.`
            : reason;

    return (
        <section className="panel" aria-labelledby="prTitle">
            <PanelHeader
                id="prTitle"
                season={season}
                title={`${info.name} ${ranked ? 'Percentile Rankings' : 'Stats'}`}
            />
            {unrankedNote && (
                <p className="text-ink-2 text-ui m-0 px-3 pb-1 text-center sm:px-[22px]">
                    {unrankedNote}
                </p>
            )}
            <div className="px-3 pb-[18px] sm:px-[22px]">
                <Section
                    Icon={Gauge}
                    title="Performance"
                    stats={panelStats(group, 'performance')}
                    car={car}
                    ranked={ranked}
                    first
                />
                <Section
                    Icon={TrainTrack}
                    title="Workload"
                    stats={panelStats(group, 'workload')}
                    car={car}
                    ranked={ranked}
                />
                <div className="text-ink-2 text-ui mt-[18px] flex flex-wrap justify-center gap-x-[22px] gap-y-1">
                    {info.mode === 'rail' && car.top_speed_mph != null && (
                        <span>
                            <StatTerm id="cruise-speed" />{' '}
                            <b className="text-ink font-medium">
                                {fmtNum(car.top_speed_mph, 1)} mph
                            </b>
                        </span>
                    )}
                    {car.crowd_load_pct != null && (
                        <span>
                            <StatTerm id="crowding" />{' '}
                            <b className="text-ink font-medium">{fmtNum(car.crowd_load_pct, 1)}%</b>
                        </span>
                    )}
                    {info.mode === 'bus' && car.routes != null && (
                        <span>
                            <StatTerm id="routes-run" />{' '}
                            <b className="text-ink font-medium">{car.routes}</b>
                        </span>
                    )}
                    <span>
                        Trips <b className="text-ink font-medium">{fmtInt(car.trips)}</b>
                    </span>
                </div>
                {rankedNote && (
                    <p className="text-ink-3 text-meta mt-2.5 mb-0 text-center">{rankedNote}</p>
                )}
                <Link
                    to="/glossary"
                    className="text-brand text-ui mt-3 block text-center underline"
                >
                    How these stats work{' '}
                    <ArrowRight className="inline size-[1em] align-[-0.125em]" strokeWidth={2.5} />
                </Link>
            </div>
        </section>
    );
}
