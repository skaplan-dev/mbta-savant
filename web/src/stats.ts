import type { CarStats, Metric } from './api';
import {
    dwellSaved,
    fmtInt,
    fmtNum,
    fmtSaved,
    fmtSavedPct,
    savedPct,
    timeSaved,
    travelSaved,
} from './format';
import type { StatId } from './glossary';
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
        id: 'time-saved',
        pct: 'trip_time_sec',
        section: 'performance',
        value: timeSaved,
        text: (c) => {
            const v = timeSaved(c);

            return v == null ? '–' : `${fmtSaved(v)} · ${fmtSavedPct(savedPct(c))}`;
        },
        brief: (c) => fmtSaved(timeSaved(c)),
    },
    {
        id: 'travel-time',
        pct: 'travel_time_sec',
        section: 'performance',
        value: travelSaved,
        text: (c) => fmtSaved(travelSaved(c)),
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
    'time-saved',
    'days-in-service',
    'iron-horse',
    'travel-time',
    'dwell-time',
    'consistency',
    'on-schedule',
    'miles',
    'routes-run',
];

export const boardStats = (group: GroupId): Stat[] =>
    BOARD_ORDER.flatMap((id) => forGroup(group).filter((s) => s.id === id));

export const panelStats = (group: GroupId, section: Stat['section']): Stat[] =>
    forGroup(group).filter((s) => s.section === section && !s.boardOnly);

/** A route board's columns: the bus board without Routes Run, which is always one route there. */
export const routeBoardStats = (): Stat[] => boardStats('bus').filter((s) => s.id !== 'routes-run');
