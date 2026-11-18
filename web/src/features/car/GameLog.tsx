import { useRef, useState, type KeyboardEvent } from 'react';
import type { Car } from '../../api';
import { fmtNum, GROUPS, pctColor, signed, type GroupId } from '../../format';
import CarPill from '../../components/CarPill';
import { ShareBar } from './BioPanel';
import { dayScore } from './calendar';
import { routeCounts } from './shared';

export type TabId = 'log' | 'mates';

const PAGE = 15;
const th = 'border-ink-2 border-b px-2.5 py-2.5 text-right font-bold first:text-left';
const td = 'border-b border-[#e3eaec] px-2.5 py-2 text-right first:text-left';

/** Pill tabs: GAME LOG, plus COUPLED WITH (rail) or ROUTES (bus). */
export default function CarTabs({
    group,
    season,
    car,
    avg,
    tab,
    onTab,
}: {
    group: GroupId;
    season: string;
    car: Car;
    avg: number | null;
    tab: TabId;
    onTab: (t: TabId) => void;
}) {
    const isBus = group === 'bus';

    const tabs: [TabId, string][] = [
        ['log', 'GAME LOG'],
        ['mates', isBus ? 'ROUTES' : 'COUPLED WITH'],
    ];

    const refs = useRef<(HTMLButtonElement | null)[]>([]);

    const onKey = (e: KeyboardEvent, i: number) => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;

        if (!d) return;
        const j = (i + d + tabs.length) % tabs.length;
        onTab(tabs[j][0]);
        refs.current[j]?.focus();
    };

    return (
        <div id="tabs" className="scroll-mt-4">
            <div
                role="tablist"
                aria-label="Car details"
                className="mt-[34px] mb-5 flex justify-center gap-1.5"
            >
                {tabs.map(([id, label], i) => (
                    <button
                        key={id}
                        ref={(el) => {
                            refs.current[i] = el;
                        }}
                        role="tab"
                        id={`tab-${id}`}
                        aria-selected={tab === id}
                        aria-controls={`panel-${id}`}
                        tabIndex={tab === id ? 0 : -1}
                        onClick={() => onTab(id)}
                        onKeyDown={(e) => onKey(e, i)}
                        className={`cursor-pointer rounded-full border px-3.5 py-3 text-[15px] tracking-[0.04em] sm:px-[34px] sm:text-lg ${
                            tab === id
                                ? 'bg-brand-2 border-brand-2 text-white'
                                : 'border-panel-line text-ink hover:bg-wash bg-white'
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>
            <div
                role="tabpanel"
                id={`panel-${tab}`}
                aria-labelledby={`tab-${tab}`}
                className="overflow-x-auto"
            >
                {tab === 'log' ? (
                    <GameLog car={car} avg={avg} isBus={isBus} />
                ) : isBus ? (
                    <RoutesTable car={car} />
                ) : (
                    <MatesTable car={car} group={group} season={season} />
                )}
            </div>
        </div>
    );
}

function GameLog({ car, avg, isBus }: { car: Car; avg: number | null; isBus: boolean }) {
    const [all, setAll] = useState(false);
    const rows = [...car.game_log].reverse();
    const shown = all ? rows : rows.slice(0, PAGE);

    if (!rows.length)
        return <p className="text-ink-2 text-center text-lg">No service days this season.</p>;

    return (
        <>
            <table className="mb-4 w-full border-collapse text-base sm:text-lg">
                <thead>
                    <tr>
                        <th className={th}>Date</th>
                        <th className={th}>Trips</th>
                        {!isBus && <th className={`${th} max-sm:hidden`}>Miles</th>}
                        <th className={th}>Time Saved / stop</th>
                        <th className={`${th} max-sm:hidden`}>{isBus ? 'Routes' : 'Lines'}</th>
                    </tr>
                </thead>
                <tbody>
                    {shown.map((g) => {
                        const saved = g.ttoe_sec != null && avg != null ? avg - g.ttoe_sec : null;

                        return (
                            <tr key={g.date} className="hover:[&>td]:bg-wash">
                                <td className={td}>
                                    {new Date(`${g.date}T12:00:00`).toLocaleDateString('en-US', {
                                        weekday: 'short',
                                        month: 'short',
                                        day: 'numeric',
                                    })}
                                </td>
                                <td className={td}>{g.trips}</td>
                                {!isBus && (
                                    <td className={`${td} max-sm:hidden`}>{fmtNum(g.miles, 0)}</td>
                                )}
                                <td className={td}>
                                    <span
                                        className="inline-block min-w-[72px] rounded-[3px] px-2 py-0.5 text-center font-medium text-white"
                                        style={{
                                            background:
                                                saved == null
                                                    ? '#9aa5a9'
                                                    : pctColor(dayScore(g.ttoe_sec, avg)),
                                        }}
                                    >
                                        {signed(saved, 1, ' s')}
                                    </span>
                                </td>
                                <td className={`${td} max-sm:hidden`}>{g.routes.join(', ')}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            {rows.length > PAGE && (
                <div className="mb-8 text-center">
                    <button
                        type="button"
                        onClick={() => setAll(!all)}
                        className="border-panel-line text-brand hover:bg-wash cursor-pointer rounded-full border bg-white px-5 py-2 text-base"
                    >
                        {all ? 'Show fewer days' : `Show all ${rows.length} days`}
                    </button>
                </div>
            )}
        </>
    );
}

function MatesTable({ car, group, season }: { car: Car; group: GroupId; season: string }) {
    if (!car.teammates.length)
        return <p className="text-ink-2 text-center text-lg">No coupled cars recorded.</p>;
    const max = car.teammates[0][1];

    return (
        <table className="mb-8 w-full border-collapse text-base sm:text-lg">
            <thead>
                <tr>
                    <th className={th}>Car</th>
                    <th className={`${th} w-1/2 text-left!`}>Trips together</th>
                    <th className={th}>Trips</th>
                    <th className={th}>Share</th>
                </tr>
            </thead>
            <tbody>
                {car.teammates.map(([n, k]) => (
                    <tr key={n} className="hover:[&>td]:bg-wash">
                        <td className={td}>
                            <CarPill group={group} number={n} season={season} />
                        </td>
                        <td className={td}>
                            <ShareBar frac={k / max} color={GROUPS[group].color} />
                        </td>
                        <td className={td}>{k.toLocaleString('en-US')}</td>
                        <td className={td}>{Math.round((k / car.trips) * 100)}%</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function RoutesTable({ car }: { car: Car }) {
    const routes = routeCounts(car);

    if (!routes.length)
        return <p className="text-ink-2 text-center text-lg">No routes recorded.</p>;
    const max = routes[0].days;
    const total = car.game_log.length;

    return (
        <table className="mb-8 w-full border-collapse text-base sm:text-lg">
            <thead>
                <tr>
                    <th className={th}>Route</th>
                    <th className={`${th} w-1/2 text-left!`}>Days on route</th>
                    <th className={th}>Days</th>
                    <th className={th}>Share</th>
                </tr>
            </thead>
            <tbody>
                {routes.map((r) => (
                    <tr key={r.route} className="hover:[&>td]:bg-wash">
                        <td className={td}>
                            <span className="bg-line-bus text-ink inline-block min-w-[54px] rounded-full px-1.5 py-px text-center text-[15px] font-medium">
                                {r.route}
                            </span>
                        </td>
                        <td className={td}>
                            <ShareBar frac={r.days / max} color={GROUPS.bus.color} />
                        </td>
                        <td className={td}>{r.days}</td>
                        <td className={td}>{Math.round((r.days / total) * 100)}%</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
