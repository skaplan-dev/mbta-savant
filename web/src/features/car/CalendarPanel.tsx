import type { Car, WindowInfo } from '../../api';
import { pctColor, seasonLabel, signed } from '../../format';
import {
    dayScore,
    monthSummaries,
    savedShort,
    weekGrid,
    yearMonths,
    type CalDay,
} from './calendar';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HELP =
    'Each square is a service day, colored by Time Saved that day: red = faster than the line’s average car, blue = slower.';

export default function CalendarPanel({
    season,
    car,
    avg,
    window,
    latest,
}: {
    season: string;
    car: Car;
    /** The line's average ttoe_sec for this window (group file `averages.ttoe_sec`). */
    avg: number | null;
    window: WindowInfo | undefined;
    latest: string | null;
}) {
    const days = new Map(car.game_log.map((g) => [g.date, g]));
    const cellFill = (date: string) => {
        const g = days.get(date);
        return { g, fill: g ? pctColor(dayScore(g.ttoe_sec, avg)) : 'var(--color-track)' };
    };
    const title = (d: CalDay) => {
        const g = days.get(d.date);
        if (!g) return `${d.date} · did not run`;
        const saved =
            g.ttoe_sec != null && avg != null
                ? ` · ${signed(avg - g.ttoe_sec, 1, ' s')} saved per stop`
                : '';
        return `${d.date} · ${g.trips} trips${saved}`;
    };

    let svg;
    if (season === 'last30') {
        const start = window?.start ?? car.game_log[0]?.date;
        const end = window?.end ?? latest ?? car.game_log.at(-1)?.date;
        const grid = start && end ? weekGrid(start, end) : { weeks: 0, days: [] };
        const cell = 40,
            gap = 5,
            W = 7 * (cell + gap) - gap,
            H = 20 + grid.weeks * (cell + gap);
        svg = (
            <svg
                width="100%"
                viewBox={`0 0 ${W} ${H}`}
                role="img"
                aria-label="Last 30 days service calendar"
                className="block"
            >
                {DOW.map((t, i) => (
                    <text
                        key={t}
                        x={i * (cell + gap) + cell / 2}
                        y="13"
                        fontSize="12"
                        textAnchor="middle"
                        className="fill-ink-2"
                    >
                        {t}
                    </text>
                ))}
                {grid.days.map((d) => {
                    const { g, fill } = cellFill(d.date);
                    const x = d.col * (cell + gap),
                        y = 20 + d.row * (cell + gap);
                    return (
                        <g key={d.date}>
                            <rect x={x} y={y} width={cell} height={cell} rx="3" fill={fill}>
                                <title>{title(d)}</title>
                            </rect>
                            <text
                                x={x + 5}
                                y={y + 15}
                                fontSize="12"
                                style={{ fill: g ? '#fff' : 'var(--color-ink-3)' }}
                                pointerEvents="none"
                            >
                                {d.dayOfMonth}
                            </text>
                        </g>
                    );
                })}
            </svg>
        );
    } else {
        const year = Number(season);
        const end = latest && latest < `${season}-12-31` ? latest : `${season}-12-31`;
        const months = yearMonths(year, end);
        const cell = 13,
            gap = 2,
            mw = 7 * (cell + gap),
            mh = 18 + 6 * (cell + gap),
            cols = 4,
            padX = 14,
            padY = 10;
        const rows = Math.ceil(months.length / cols);
        const W = cols * mw + (cols - 1) * padX,
            H = rows * mh + (rows - 1) * padY;
        svg = (
            <svg
                width="100%"
                viewBox={`0 0 ${W} ${H}`}
                role="img"
                aria-label={`${season} service calendar`}
                className="block"
            >
                {months.map((m, i) => {
                    const ox = (i % cols) * (mw + padX),
                        oy = Math.floor(i / cols) * (mh + padY);
                    return (
                        <g key={m.key}>
                            <text
                                x={ox}
                                y={oy + 11}
                                fontSize="12"
                                fontWeight="500"
                                className="fill-ink"
                            >
                                {m.label}
                            </text>
                            {m.days.map((d) => (
                                <rect
                                    key={d.date}
                                    x={ox + d.col * (cell + gap)}
                                    y={oy + 18 + d.row * (cell + gap)}
                                    width={cell}
                                    height={cell}
                                    rx="2"
                                    fill={cellFill(d.date).fill}
                                >
                                    <title>{title(d)}</title>
                                </rect>
                            ))}
                        </g>
                    );
                })}
            </svg>
        );
    }

    // Nine months fit the panel without scrolling at every width.
    const summary = monthSummaries(car.game_log, 9);
    const th = 'px-0.5 py-1 text-[15px] font-medium';
    const td = 'px-0.5 py-[5px] text-center';
    const k = 'text-brand pr-1.5 text-left text-base whitespace-nowrap';

    return (
        <section className="panel min-[761px]:max-[1179px]:col-span-2" aria-labelledby="calTitle">
            <div className="flex items-center justify-center gap-3 px-[18px] pt-4 pb-2.5">
                <h2 id="calTitle" className="m-0 text-center text-[27px] font-medium">
                    <span className="border-brand-2 border-b-[3px] border-dotted pb-0.5">
                        {seasonLabel(season)}
                    </span>{' '}
                    Service Calendar
                </h2>
                <span className="group relative flex-none">
                    <button
                        type="button"
                        aria-label="About the service calendar"
                        aria-describedby="calHelp"
                        className="border-brand-2 text-brand-2 hover:bg-wash grid size-[30px] cursor-help place-items-center rounded-full border-[1.5px] bg-transparent p-0 text-[17px]"
                    >
                        ?
                    </button>
                    <span
                        id="calHelp"
                        role="tooltip"
                        className="bg-ink invisible absolute top-[calc(100%+8px)] right-0 z-10 w-[260px] max-w-[80vw] rounded-md px-3 py-2.5 text-left text-[15px] leading-[1.35] font-normal text-white opacity-0 shadow-[0_6px_20px_rgb(0_0_0/0.2)] transition-opacity duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 motion-reduce:transition-none"
                    >
                        {HELP}
                    </span>
                </span>
            </div>
            <div className="text-ink-2 mt-0.5 mb-2.5 flex flex-wrap items-center justify-center gap-2.5 text-[15px]">
                <span>SLOWER</span>
                <span className="h-2.5 w-40 bg-[linear-gradient(90deg,var(--color-poor),#c8c8c8,var(--color-great))]" />
                <span>FASTER</span>
                <span className="ml-2.5 inline-flex items-center gap-1.5">
                    <i className="bg-track inline-block size-3" />
                    didn&rsquo;t run
                </span>
            </div>
            <div className="px-4 pt-1 pb-1.5">{svg}</div>
            {summary.length > 0 && (
                <div className="mx-3.5 mt-2 mb-[18px] overflow-x-auto">
                    <table className="w-full border-collapse text-[15px]">
                        <thead>
                            <tr>
                                <th className={th} />
                                {summary.map((m) => (
                                    <th key={m.key} className={th}>
                                        {m.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className={k} />
                                {summary.map((m) => (
                                    <td key={m.key} className={td}>
                                        <span
                                            className="mx-0.5 mb-0.5 block h-2.5 rounded-[3px]"
                                            style={{ background: pctColor(dayScore(m.ttoe, avg)) }}
                                        />
                                    </td>
                                ))}
                            </tr>
                            <tr>
                                <td className={k}>DAYS</td>
                                {summary.map((m) => (
                                    <td key={m.key} className={td}>
                                        {m.days}
                                    </td>
                                ))}
                            </tr>
                            <tr>
                                <td className={k}>TRIPS/DAY</td>
                                {summary.map((m) => (
                                    <td key={m.key} className={td}>
                                        {m.tripsPerDay}
                                    </td>
                                ))}
                            </tr>
                            <tr>
                                <td className={`${k} italic`}>SAVED/STOP</td>
                                {summary.map((m) => (
                                    <td key={m.key} className={td}>
                                        {m.ttoe == null || avg == null
                                            ? '–'
                                            : savedShort(avg - m.ttoe)}
                                    </td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
