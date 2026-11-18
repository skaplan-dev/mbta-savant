import { Link } from '@tanstack/react-router';
import type { Car, GroupFile } from '../../api';
import PercentileBar from '../../components/PercentileBar';
import StatTerm from '../../components/StatTerm';
import {
    doorLabel,
    fmtNum,
    GROUPS,
    pacePlus,
    seasonLabel,
    signed,
    timeSaved,
    type GroupId,
} from '../../format';
import type { StatId } from '../../glossary';
import { GLOSSARY } from '../../glossary';
import { isRanked, unrankedReason } from './shared';

interface Row {
    id: StatId;
    pct: number | null;
    value: string;
}

const COLS = 'grid grid-cols-[36%_minmax(0,1fr)_74px]';

function Icon({ kind }: { kind: 'watch' | 'cal' }) {
    return (
        <svg viewBox="0 0 40 40" aria-hidden="true" className="size-10">
            {kind === 'watch' ? (
                <>
                    <circle cx="20" cy="23" r="13" fill="none" stroke="#1d2427" strokeWidth="3.5" />
                    <path
                        d="M20 23 L20 14"
                        stroke="#1d2427"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                    />
                    <rect x="16" y="4" width="8" height="5" fill="#1d2427" />
                    <path
                        d="M31 11 l3-3"
                        stroke="#1d2427"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                    />
                </>
            ) : (
                <>
                    <rect
                        x="5"
                        y="8"
                        width="30"
                        height="27"
                        rx="2"
                        fill="none"
                        stroke="#1d2427"
                        strokeWidth="3.5"
                    />
                    <path d="M5 16 H35" stroke="#1d2427" strokeWidth="3.5" />
                    <path
                        d="M12 4 V11 M28 4 V11"
                        stroke="#1d2427"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                    />
                    <path
                        d="M12 24 l5 5 l10 -10"
                        stroke="var(--color-great)"
                        strokeWidth="3.5"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </>
            )}
        </svg>
    );
}

function Section({
    icon,
    title,
    rows,
    first,
}: {
    icon: 'watch' | 'cal';
    title: string;
    rows: Row[];
    first?: boolean;
}) {
    return (
        <>
            <div
                className={`border-rule flex items-end gap-2.5 border-b pb-1.5 ${first ? 'mt-2.5' : 'mt-[22px]'}`}
            >
                <Icon kind={icon} />
                <h3 className="m-0 text-[25px] font-bold">{title}</h3>
            </div>
            <div className={`${COLS} mt-3 mb-0.5 text-[17px]`} aria-hidden="true">
                <div className="col-start-2 flex justify-between gap-1.5 px-1.5">
                    {(
                        [
                            ['POOR', 'text-poor'],
                            ['AVERAGE', 'text-[#9aa5a9]'],
                            ['GREAT', 'text-great'],
                        ] as const
                    ).map(([t, c]) => (
                        <span key={t} className={`flex flex-col items-center gap-px ${c}`}>
                            {t}
                            <span className="border-x-[6px] border-b-[6px] border-x-transparent border-b-current" />
                        </span>
                    ))}
                </div>
            </div>
            {rows.map((r, i) => (
                <div key={r.id} className={`${COLS} min-h-10 items-center`}>
                    <div
                        className={`flex h-full items-center justify-end pr-2.5 text-right text-lg ${i ? 'border-t border-dashed border-[#d6e1e4]' : ''}`}
                    >
                        <StatTerm id={r.id} />
                    </div>
                    <PercentileBar pct={r.pct} label={GLOSSARY[r.id].name} />
                    <div
                        className={`flex h-full items-center justify-end text-right text-[17px] ${i ? 'border-t border-dashed border-[#d6e1e4]' : ''}`}
                    >
                        {r.value}
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
    const lineName = GROUPS[group].name;
    const isBus = group === 'bus';
    const ranked = isRanked(group, car);
    const p = (v: number | null) => (ranked ? v : null);
    const pace = pacePlus(car);

    const performance: Row[] = [
        { id: 'time-saved', pct: p(car.pct.ttoe_sec), value: signed(timeSaved(car), 1, ' s') },
        {
            id: 'pace-plus',
            pct: p(car.pct.speed_vs_expected_pct),
            value: pace == null ? '–' : String(pace),
        },
        { id: 'on-schedule', pct: p(car.pct.on_time_pct), value: fmtNum(car.on_time_pct, 1) },
        {
            id: 'consistency',
            pct: p(car.pct.steadiness_sec),
            value: car.steadiness_sec == null ? '–' : `${fmtNum(car.steadiness_sec, 0)} s`,
        },
        { id: 'door-time', pct: p(car.pct.door_time_sec), value: doorLabel(car.door_time_sec) },
    ];
    const workload: Row[] = [
        {
            id: 'days-in-service',
            pct: p(car.pct.games_played_pct),
            value: car.games_played_pct == null ? '–' : `${fmtNum(car.games_played_pct, 0)}%`,
        },
        {
            id: 'iron-horse',
            pct: p(car.pct.iron_horse_days),
            value: car.iron_horse_days == null ? '–' : `${car.iron_horse_days} d`,
        },
    ];
    if (!isBus)
        workload.push({
            id: 'miles',
            pct: p(car.pct.miles),
            value: car.miles == null ? '–' : `${(car.miles / 1000).toFixed(1)}k`,
        });

    const rankedCount = groupFile?.cars.filter((c) => c.qualified && c.ranked).length;
    const note = ranked
        ? rankedCount
            ? isBus
                ? `Ranked against ${rankedCount} qualified buses.`
                : `Ranked against ${rankedCount} qualified ${lineName} cars.`
            : null
        : unrankedReason(group, car, groupFile?.qualify_min_trips);

    return (
        <section className="panel" aria-labelledby="prTitle">
            <div className="flex items-center justify-center gap-3 px-[18px] pt-4 pb-2.5">
                <h2 id="prTitle" className="m-0 text-center text-[27px] font-medium">
                    <span className="border-brand-2 border-b-[3px] border-dotted pb-0.5">
                        {seasonLabel(season)}
                    </span>{' '}
                    {lineName} Percentile Rankings
                </h2>
            </div>
            <div className="px-3 pb-[18px] sm:px-[22px]">
                <Section icon="watch" title="Performance" rows={performance} first />
                <Section icon="cal" title="Workload" rows={workload} />
                <div className="text-ink-2 mt-[18px] flex flex-wrap justify-center gap-x-[22px] gap-y-1 text-[17px]">
                    {!isBus && car.top_speed_mph != null && (
                        <span>
                            <StatTerm id="cruise-speed" align="left" />{' '}
                            <b className="text-ink font-medium">
                                {fmtNum(car.top_speed_mph, 1)} mph
                            </b>
                        </span>
                    )}
                    {car.crowd_load_pct != null && (
                        <span>
                            <StatTerm id="crowding" align="center" />{' '}
                            <b className="text-ink font-medium">{fmtNum(car.crowd_load_pct, 1)}%</b>
                        </span>
                    )}
                    {isBus && car.routes != null && (
                        <span>
                            <StatTerm id="routes-run" align="left" />{' '}
                            <b className="text-ink font-medium">{car.routes}</b>
                        </span>
                    )}
                    <span>
                        Trips{' '}
                        <b className="text-ink font-medium">{car.trips.toLocaleString('en-US')}</b>
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
