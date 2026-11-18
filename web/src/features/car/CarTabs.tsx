import { getRouteApi } from '@tanstack/react-router';
import { useRef, useState, type KeyboardEvent } from 'react';
import type { Car } from '../../api';
import { fmtInt, fmtSaved, pctColor } from '../../format';
import { GROUPS, type GroupId } from '../../groups';
import { dayScore } from './calendar';
import PartnerTable from './PartnerTable';

export type TabId = 'log' | 'mates';

const route = getRouteApi('/car/$group/$number');

const PAGE = 15;
const th = 'border-ink-2 border-b px-2.5 py-2.5 text-right font-bold first:text-left';
const td = 'border-b border-table-rule px-2.5 py-2 text-right first:text-left';

/** Pill tabs: GAME LOG, plus COUPLED WITH (rail) or ROUTES (bus). The tab lives in `?tab=`. */
export default function CarTabs({
    group,
    season,
    car,
    avg,
    tab,
}: {
    group: GroupId;
    season: string;
    car: Car;
    avg: number | null;
    tab: TabId;
}) {
    const navigate = route.useNavigate();

    const tabs: [TabId, string][] = [
        ['log', 'GAME LOG'],
        ['mates', GROUPS[group].partner.tab],
    ];

    const refs = useRef<(HTMLButtonElement | null)[]>([]);

    const select = (t: TabId) =>
        void navigate({
            search: (prev) => ({ ...prev, tab: t === 'mates' ? t : undefined }),
            replace: true,
            resetScroll: false,
        });

    const onKey = (e: KeyboardEvent, i: number) => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;

        if (!d) return;
        const j = (i + d + tabs.length) % tabs.length;
        select(tabs[j][0]);
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
                        onClick={() => select(id)}
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
                    <GameLog car={car} avg={avg} group={group} />
                ) : (
                    <PartnerTable car={car} group={group} season={season} />
                )}
            </div>
        </div>
    );
}

function GameLog({ car, avg, group }: { car: Car; avg: number | null; group: GroupId }) {
    const [all, setAll] = useState(false);
    const { showMiles, placesLabel } = GROUPS[group];
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
                        {showMiles && <th className={`${th} max-sm:hidden`}>Miles</th>}
                        <th className={th}>Time Saved / stop</th>
                        <th className={`${th} max-sm:hidden`}>{placesLabel}</th>
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
                                {showMiles && (
                                    <td className={`${td} max-sm:hidden`}>{fmtInt(g.miles)}</td>
                                )}
                                <td className={td}>
                                    <span
                                        className="inline-block min-w-[72px] rounded-[3px] px-2 py-0.5 text-center font-medium text-white"
                                        style={{
                                            background:
                                                saved == null
                                                    ? 'var(--color-average)'
                                                    : pctColor(dayScore(g.ttoe_sec, avg)),
                                        }}
                                    >
                                        {fmtSaved(saved)}
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
