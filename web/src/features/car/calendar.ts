import type { GameLogEntry } from '../../api';
import { fmtSaved, pctColor, pctInk, signed } from '../../format';

// Pure date math for the service calendar. Dates are ISO "YYYY-MM-DD" strings handled in UTC so
// the layout never shifts with the viewer's time zone.

const DAY = 86_400_000;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Sunday = 0 … Saturday = 6 (US calendars). A 30-day window spans five or six week rows. */
const weekday = (ms: number) => new Date(ms).getUTCDay();

export interface CalDay {
    date: string;
    col: number;
    /** Week row within the month (or within the whole grid for last30). */
    row: number;
    dayOfMonth: number;
}

export interface CalMonth {
    key: string; // "2026-04"
    label: string; // "APR"
    days: CalDay[];
}

/** One small-multiple month per calendar month of `year` that starts on or before `end`. */
export function yearMonths(year: number, end: string): CalMonth[] {
    const endMs = toMs(end);
    const out: CalMonth[] = [];

    for (let m = 0; m < 12; m++) {
        const first = Date.UTC(year, m, 1);

        if (first > endMs) break;
        const lead = weekday(first);
        const days: CalDay[] = [];

        for (let ms = first; new Date(ms).getUTCMonth() === m && ms <= endMs; ms += DAY) {
            const d = new Date(ms).getUTCDate();
            const idx = lead + d - 1;
            days.push({ date: toIso(ms), col: idx % 7, row: Math.floor(idx / 7), dayOfMonth: d });
        }

        out.push({ key: `${year}-${String(m + 1).padStart(2, '0')}`, label: MONTHS[m], days });
    }

    return out;
}

export interface WeekGrid {
    weeks: number;
    days: CalDay[];
}

/** A Sunday-first week grid covering start..end inclusive. */
export function weekGrid(start: string, end: string): WeekGrid {
    const s = toMs(start);
    const e = toMs(end);
    const sunday = s - weekday(s) * DAY;
    const days: CalDay[] = [];

    for (let ms = s; ms <= e; ms += DAY) {
        days.push({
            date: toIso(ms),
            col: weekday(ms),
            row: Math.floor((ms - sunday) / DAY / 7),
            dayOfMonth: new Date(ms).getUTCDate(),
        });
    }

    return { weeks: (days.at(-1)?.row ?? -1) + 1, days };
}

/** Month-summary label: one decimal, but whole seconds once |v| rounds to 10+ so cells don't clip. */
export function savedShort(v: number): string {
    return signed(v, Math.abs(v) >= 9.95 ? 0 : 1);
}

/** 0-100 score for a day (faster than the line's typical car → high/red), per segment of a trip. */
export function dayScore(
    tripSec: number | null | undefined,
    typical: number | null | undefined,
    segs: number | null | undefined
): number {
    if (tripSec == null || typical == null || !segs) return 50;

    return 50 - ((tripSec - typical) / segs) * 6;
}

/**
 * A calendar cell's fill and the color of its day number: a day that ran is on the percentile scale
 * (black or white numbers, whichever reads); one that did not is the neutral track.
 */
export function dayColors(
    day: GameLogEntry | undefined,
    typical: number | null,
    segs: number | null
) {
    if (!day) return { fill: 'var(--color-track)', ink: 'var(--color-ink-2)' };
    const score = dayScore(day.trip_time_sec, typical, segs);

    return { fill: pctColor(score), ink: pctInk(score) };
}

/** What a calendar day says, for its hover title and the tap readout. */
export function dayText(
    date: string,
    day: GameLogEntry | undefined,
    typical: number | null
): string {
    if (!day) return `${date} · did not run`;

    const saved =
        day.trip_time_sec != null && typical != null
            ? ` · ${fmtSaved(typical - day.trip_time_sec)} saved per trip`
            : '';

    return `${date} · ${day.trips} trips${saved}`;
}

export interface MonthSummary {
    key: string;
    label: string; // "Apr"
    days: number;
    tripsPerDay: number;
    /** Mean trip time over days with a value, or null. */
    trip: number | null;
}

/** Per-month rollup of the game log, oldest first, keeping the last `limit` months. */
export function monthSummaries(log: readonly GameLogEntry[], limit = 11): MonthSummary[] {
    const by = new Map<string, GameLogEntry[]>();

    for (const g of log) {
        const k = g.date.slice(0, 7);
        const month = by.get(k);

        if (month) month.push(g);
        else by.set(k, [g]);
    }

    return [...by]
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-limit)
        .map(([key, days]) => {
            const vals = days.map((g) => g.trip_time_sec).filter((v): v is number => v != null);
            const label = MONTHS[Number(key.slice(5)) - 1];

            return {
                key,
                label: label[0] + label.slice(1).toLowerCase(),
                days: days.length,
                tripsPerDay: Math.round(days.reduce((t, g) => t + g.trips, 0) / days.length),
                trip: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
            };
        });
}
