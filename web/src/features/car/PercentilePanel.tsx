import { Link } from '@tanstack/react-router';
import type { Car, GroupFile } from '../../api';
import { CalendarIcon, StopwatchIcon } from '../../components/icons';
import PanelHeader from '../../components/PanelHeader';
import PercentileBar from '../../components/PercentileBar';
import StatTerm from '../../components/StatTerm';
import { fmtInt, fmtNum } from '../../format';
import { GLOSSARY } from '../../glossary';
import { GROUPS, type GroupId } from '../../groups';
import { isRanked, unrankedReason } from '../../rank';
import { panelStats, type Stat } from '../../stats';

const COLS = 'grid grid-cols-[36%_minmax(0,1fr)_74px]';
const ROW_RULE = 'border-t border-dashed border-row-rule';

const SCALE = [
    ['POOR', 'text-poor'],
    ['AVERAGE', 'text-average'],
    ['GREAT', 'text-great'],
] as const;

function Section({
    icon,
    title,
    stats,
    car,
    ranked,
    first = false,
}: {
    icon: 'watch' | 'cal';
    title: string;
    stats: Stat[];
    car: Car;
    ranked: boolean;
    first?: boolean;
}) {
    const Icon = icon === 'watch' ? StopwatchIcon : CalendarIcon;

    return (
        <>
            <div
                className={`border-rule flex items-end gap-2.5 border-b pb-1.5 ${first ? 'mt-2.5' : 'mt-[22px]'}`}
            >
                <Icon className="size-10" detailed />
                <h3 className="m-0 text-[25px] font-bold">{title}</h3>
            </div>
            <div className={`${COLS} mt-3 mb-0.5 text-[17px]`} aria-hidden="true">
                <div className="col-start-2 flex justify-between gap-1.5 px-1.5">
                    {SCALE.map(([t, c]) => (
                        <span key={t} className={`flex flex-col items-center gap-px ${c}`}>
                            {t}
                            <span className="border-x-[6px] border-b-[6px] border-x-transparent border-b-current" />
                        </span>
                    ))}
                </div>
            </div>
            {stats.map((s, i) => (
                <div key={s.id} className={`${COLS} min-h-10 items-center`}>
                    <div
                        className={`flex h-full items-center justify-end pr-2.5 text-right text-lg ${i ? ROW_RULE : ''}`}
                    >
                        <StatTerm id={s.id} />
                    </div>
                    <PercentileBar
                        pct={ranked ? car.pct[s.pct] : null}
                        label={GLOSSARY[s.id].name}
                    />
                    <div
                        className={`flex h-full items-center justify-end text-right text-[17px] ${i ? ROW_RULE : ''}`}
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
    groupFile,
}: {
    group: GroupId;
    season: string;
    car: Car;
    groupFile: GroupFile | null | undefined;
}) {
    const info = GROUPS[group];
    const ranked = isRanked(group, car);
    const rankedCount = groupFile?.cars.filter((c) => c.qualified && c.ranked).length;

    const note = ranked
        ? rankedCount
            ? `Ranked against ${rankedCount} qualified ${info.pool}.`
            : null
        : unrankedReason(group, car, groupFile?.qualify_min_trips);

    return (
        <section className="panel" aria-labelledby="prTitle">
            <PanelHeader id="prTitle" season={season} title={`${info.name} Percentile Rankings`} />
            <div className="px-3 pb-[18px] sm:px-[22px]">
                <Section
                    icon="watch"
                    title="Performance"
                    stats={panelStats(group, 'performance')}
                    car={car}
                    ranked={ranked}
                    first
                />
                <Section
                    icon="cal"
                    title="Workload"
                    stats={panelStats(group, 'workload')}
                    car={car}
                    ranked={ranked}
                />
                <div className="text-ink-2 mt-[18px] flex flex-wrap justify-center gap-x-[22px] gap-y-1 text-[17px]">
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
                {note && <p className="text-ink-3 mt-2.5 mb-0 text-center text-[15px]">{note}</p>}
                <Link
                    to="/glossary"
                    className="text-brand mt-3 block text-center text-base underline"
                >
                    How these stats work →
                </Link>
            </div>
        </section>
    );
}
