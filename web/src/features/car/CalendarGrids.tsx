import type { GameLogEntry } from '../../api';
import { dayColors, dayText, weekGrid, yearMonths, type CalDay } from './calendar';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** How each grid looks up and describes a day. */
export interface DayLookup {
    days: ReadonlyMap<string, GameLogEntry>;
    /** The line's typical car's trip_time_sec for the window. */
    typical: number | null;
    /** Segments per trip on the line. */
    segs: number | null;
}

const colors = ({ days, typical, segs }: DayLookup, date: string) =>
    dayColors(days.get(date), typical, segs);

function DayTitle({ lookup: { days, typical }, day }: { lookup: DayLookup; day: CalDay }) {
    return <title>{dayText(day.date, days.get(day.date), typical)}</title>;
}

/** Which day the readout shows, and how a cell reports a tap. */
export interface DayPicker {
    selected: string | null;
    onPick: (date: string) => void;
}

const A11Y_HINT = 'Every day is listed in the game log below.';

const L30 = { cell: 40, gap: 5, head: 20 };

/** last30: one Sunday-first week grid with day numbers. */
export function LastThirtyGrid({
    lookup,
    start,
    end,
    selected,
    onPick,
}: DayPicker & {
    lookup: DayLookup;
    start: string | undefined;
    end: string | undefined;
}) {
    const { cell, gap, head } = L30;
    const grid = start && end ? weekGrid(start, end) : { weeks: 0, days: [] };
    const W = 7 * (cell + gap) - gap;
    const H = head + grid.weeks * (cell + gap);

    return (
        <svg
            width="100%"
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`Last 30 days service calendar. ${A11Y_HINT}`}
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
                const x = d.col * (cell + gap),
                    y = head + d.row * (cell + gap);

                return (
                    <g key={d.date}>
                        <rect
                            x={x}
                            y={y}
                            width={cell}
                            height={cell}
                            rx="3"
                            fill={colors(lookup, d.date).fill}
                            onClick={() => onPick(d.date)}
                            className="cursor-pointer"
                            stroke={selected === d.date ? 'var(--color-ink)' : 'none'}
                            strokeWidth="2"
                        >
                            <DayTitle lookup={lookup} day={d} />
                        </rect>
                        <text
                            x={x + 5}
                            y={y + 15}
                            fontSize="12"
                            style={{
                                fill: colors(lookup, d.date).ink,
                            }}
                            pointerEvents="none"
                        >
                            {d.dayOfMonth}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}

const YEAR = { cell: 13, gap: 2, head: 18, cols: 3, padX: 16, padY: 10 };

/** A calendar year: small-multiple months, three per row, through `latest`. */
export function YearGrid({
    lookup,
    season,
    latest,
    selected,
    onPick,
}: DayPicker & {
    lookup: DayLookup;
    season: string;
    latest: string | null;
}) {
    const { cell, gap, head, cols, padX, padY } = YEAR;
    const yearEnd = `${season}-12-31`;
    const months = yearMonths(Number(season), latest && latest < yearEnd ? latest : yearEnd);
    const mw = 7 * (cell + gap);
    const mh = head + 6 * (cell + gap);
    const rows = Math.ceil(months.length / cols);
    const W = cols * mw + (cols - 1) * padX;
    const H = rows * mh + (rows - 1) * padY;

    return (
        <svg
            width="100%"
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`${season} service calendar. ${A11Y_HINT}`}
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
                            fontSize="10"
                            fontWeight="500"
                            className="fill-ink"
                        >
                            {m.label}
                        </text>
                        {m.days.map((d) => (
                            <rect
                                key={d.date}
                                x={ox + d.col * (cell + gap)}
                                y={oy + head + d.row * (cell + gap)}
                                width={cell}
                                height={cell}
                                rx="2"
                                fill={colors(lookup, d.date).fill}
                                onClick={() => onPick(d.date)}
                                className="cursor-pointer"
                                stroke={selected === d.date ? 'var(--color-ink)' : 'none'}
                                strokeWidth="2"
                            >
                                <DayTitle lookup={lookup} day={d} />
                            </rect>
                        ))}
                    </g>
                );
            })}
        </svg>
    );
}
