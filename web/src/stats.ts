import type { CarStats, Metric } from './api';
import {
    dwellSaved,
    fmtInt,
    fmtNum,
    fmtSaved,
    fmtSavedPct,
    fmtTrips,
    savedPct,
    timeSaved,
} from './format';
import { GLOSSARY, type StatId } from './glossary';
import { GROUPS, type GroupId, type Mode } from './groups';

// The ranked stats, shared by the car page's percentile panel and the line leaderboard.

export interface Stat {
    id: StatId;
    /** Percentile key in `CarStats.pct`. */
    pct: Metric;
    section: 'performance' | 'availability';
    /** Numeric value that the leaderboard cell displays, so sorting matches what is shown. */
    value: (c: CarStats) => number | null;
    text: (c: CarStats) => string;
    /** Percentile panel value, where it's shorter than the leaderboard's. */
    brief?: (c: CarStats) => string;
    /** Smaller values are better (best-first is ascending). */
    lowerBetter?: boolean;
    /** Only for this mode. */
    mode?: Mode;
    /** A leaderboard column only; the car page shows it as a fun fact instead. */
    boardOnly?: boolean;
}

export const STATS: readonly Stat[] = [
    {
        id: 'tar',
        pct: 'tar',
        section: 'performance',
        value: (c) => c.tar ?? null,
        text: (c) => fmtTrips(c.tar),
        boardOnly: true,
    },
    {
        id: 'time-saved',
        pct: 'travel_time_sec',
        section: 'performance',
        value: timeSaved,
        text: (c) => {
            const v = timeSaved(c);

            return v == null ? '–' : `${fmtSaved(v)} · ${fmtSavedPct(savedPct(c))}`;
        },
        brief: (c) => fmtSaved(timeSaved(c)),
    },
    {
        id: 'dwell-time',
        pct: 'dwell_time_sec',
        section: 'performance',
        value: dwellSaved,
        text: (c) => fmtSaved(dwellSaved(c)),
    },
    {
        id: 'consistency',
        pct: 'steadiness_sec',
        section: 'performance',
        value: (c) => c.steadiness_sec,
        text: (c) => fmtNum(c.steadiness_sec, 1, ' s'),
        lowerBetter: true,
    },
    {
        id: 'on-schedule',
        pct: 'on_time_pct',
        section: 'performance',
        value: (c) => c.on_time_pct,
        text: (c) => fmtNum(c.on_time_pct, 1, '%'),
        brief: (c) => fmtNum(c.on_time_pct, 1),
    },
    {
        id: 'days-in-service',
        pct: 'games_played_pct',
        section: 'availability',
        value: (c) => c.games_played_pct,
        text: (c) => fmtNum(c.games_played_pct, 0, '%'),
    },
    {
        id: 'iron-horse',
        pct: 'iron_horse_days',
        section: 'availability',
        value: (c) => c.iron_horse_days,
        text: (c) => fmtNum(c.iron_horse_days, 0, ' d'),
    },
    {
        id: 'miles',
        pct: 'miles',
        section: 'availability',
        value: (c) => c.miles,
        text: (c) => fmtInt(c.miles),
        brief: (c) =>
            c.miles != null && c.miles >= 1000 ? fmtNum(c.miles / 1000, 1, 'k') : fmtInt(c.miles),
        mode: 'rail',
    },
    {
        id: 'routes-run',
        pct: 'routes',
        section: 'availability',
        value: (c) => c.routes,
        text: (c) => fmtInt(c.routes),
        mode: 'bus',
        boardOnly: true,
    },
];

const forGroup = (group: GroupId) => STATS.filter((s) => !s.mode || s.mode === GROUPS[group].mode);

// Leaderboard column order; the car page's panels use registry order instead.
export const BOARD_ORDER: StatId[] = [
    'tar',
    'time-saved',
    'days-in-service',
    'iron-horse',
    'dwell-time',
    'consistency',
    'on-schedule',
    'miles',
    'routes-run',
];

const SPREAD_UNIT: Partial<Record<Metric, (w: number) => string>> = {
    tar: (w) => `${fmtInt(w)} trip${Math.round(w) === 1 ? '' : 's'}`,
    travel_time_sec: (w) => `${fmtNum(w, 1)} s`,
    dwell_time_sec: (w) => `${fmtNum(w, 1)} s`,
    steadiness_sec: (w) => `${fmtNum(w, 1)} s`,
    on_time_pct: (w) => `${fmtNum(w, 1)} points`,
    games_played_pct: (w) => `${fmtNum(w, 1)} points`,
    iron_horse_days: (w) => `${fmtInt(w)} day${Math.round(w) === 1 ? '' : 's'}`,
};

/**
 * The too-close stats among `stats`, named and, where the spread is known, with how bunched they are:
 * "Consistency (8 in 10 cars within 0.4 s of each other), On-Schedule % (8 in 10 cars within 0.6 points)".
 * The spread is the 10th-to-90th-percentile gap, hence "8 in 10".
 */
export function tooCloseList(
    stats: readonly Stat[],
    tooClose: readonly Metric[],
    spread: Partial<Record<Metric, number | null>> | undefined,
    noun: string
): string {
    // "of each other" once, on the first stat that gives a spread.
    let explained = false;

    return stats
        .filter((s) => tooClose.includes(s.pct))
        .map((s) => {
            const w = spread?.[s.pct];
            const unit = SPREAD_UNIT[s.pct];
            const name = GLOSSARY[s.id].name;

            if (w == null || !unit) return name;
            const tail = explained ? '' : ' of each other';

            explained = true;

            return `${name} (8 in 10 ${noun} within ${unit(w)}${tail})`;
        })
        .join(', ');
}

export const boardStats = (group: GroupId): Stat[] =>
    BOARD_ORDER.flatMap((id) => forGroup(group).filter((s) => s.id === id));

export const panelStats = (group: GroupId, section: Stat['section']): Stat[] =>
    forGroup(group).filter((s) => s.section === section && !s.boardOnly);

/** A route board's columns: the bus board without Routes Run, which is always one route there. */
export const routeBoardStats = (): Stat[] => boardStats('bus').filter((s) => s.id !== 'routes-run');
