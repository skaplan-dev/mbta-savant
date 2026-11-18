import type { GameLogEntry } from '../../api';

// Pure date math for the service calendar. Dates are ISO "YYYY-MM-DD" strings handled in UTC so
// the layout never shifts with the viewer's time zone.

const DAY = 86_400_000;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
/** Sunday = 0 … Saturday = 6 (US calendars; keeps any 30-day window to five rows). */
const weekday = (ms: number) => new Date(ms).getUTCDay();

export interface CalDay {
    date: string;
    /** Day of week, Sunday = 0. */
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

/** A Sunday-first week grid covering start..end inclusive; `weeks` is the number of rows used. */
export function weekGrid(start: string, end: string): { weeks: number; days: CalDay[] } {
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
    return { weeks: days.length ? days[days.length - 1].row + 1 : 0, days };
}

/** 0-100 score for a day (faster than the line average → high/red), as in the mockup. */
export function dayScore(ttoe: number | null | undefined, avg: number | null | undefined): number {
    if (ttoe == null || avg == null) return 50;
    return 50 - (ttoe - avg) * 6;
}

export interface MonthSummary {
    key: string;
    label: string; // "Apr"
    days: number;
    tripsPerDay: number;
    /** Mean ttoe over days with a value, or null. */
    ttoe: number | null;
}

/** Per-month rollup of the game log, oldest first, keeping the last `limit` months. */
export function monthSummaries(log: readonly GameLogEntry[], limit = 11): MonthSummary[] {
    const by = new Map<string, GameLogEntry[]>();
    for (const g of log) {
        const k = g.date.slice(0, 7);
        by.set(k, [...(by.get(k) ?? []), g]);
    }
    return [...by.keys()]
        .sort()
        .slice(-limit)
        .map((key) => {
            const days = by.get(key)!;
            const vals = days.map((g) => g.ttoe_sec).filter((v): v is number => v != null);
            const label = MONTHS[Number(key.slice(5)) - 1];
            return {
                key,
                label: label[0] + label.slice(1).toLowerCase(),
                days: days.length,
                tripsPerDay: Math.round(days.reduce((t, g) => t + g.trips, 0) / days.length),
                ttoe: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
            };
        });
}
