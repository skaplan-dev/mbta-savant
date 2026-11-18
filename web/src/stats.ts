import type { CarStats, Metric } from './api';
import {
    doorLabel,
    fmtInt,
    fmtMilesShort,
    fmtNum,
    fmtSaved,
    fmtUnit,
    pacePlus,
    timeSaved,
} from './format';
import type { StatId } from './glossary';
import { GROUPS, type GroupId, type Mode } from './groups';

// The ranked stats, shared by the car page's percentile panel and the line leaderboard.

export interface Stat {
    id: StatId;
    /** Percentile key in `CarStats.pct`. */
    pct: Metric;
    section: 'performance' | 'workload';
    /** Numeric value that the leaderboard cell displays, so sorting matches what is shown. */
    value: (c: CarStats) => number | null;
    /** Leaderboard cell. */
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
        pct: 'ttoe_sec',
        section: 'performance',
        value: timeSaved,
        text: (c) => fmtSaved(timeSaved(c)),
    },
    {
        id: 'pace-plus',
        pct: 'speed_vs_expected_pct',
        section: 'performance',
        value: pacePlus,
        text: (c) => fmtInt(pacePlus(c)),
    },
    {
        id: 'on-schedule',
        pct: 'on_time_pct',
        section: 'performance',
        value: (c) => c.on_time_pct,
        text: (c) => fmtUnit(c.on_time_pct, 1, '%'),
        brief: (c) => fmtNum(c.on_time_pct, 1),
    },
    {
        id: 'consistency',
        pct: 'steadiness_sec',
        section: 'performance',
        value: (c) => c.steadiness_sec,
        text: (c) => fmtUnit(c.steadiness_sec, 0, ' s'),
        lowerBetter: true,
    },
    {
        id: 'door-time',
        pct: 'door_time_sec',
        section: 'performance',
        value: (c) => c.door_time_sec,
        text: (c) => doorLabel(c.door_time_sec),
        lowerBetter: true,
    },
    {
        id: 'days-in-service',
        pct: 'games_played_pct',
        section: 'workload',
        value: (c) => c.games_played_pct,
        text: (c) => fmtUnit(c.games_played_pct, 0, '%'),
    },
    {
        id: 'iron-horse',
        pct: 'iron_horse_days',
        section: 'workload',
        value: (c) => c.iron_horse_days,
        text: (c) => fmtUnit(c.iron_horse_days, 0, ' d'),
    },
    {
        id: 'miles',
        pct: 'miles',
        section: 'workload',
        value: (c) => c.miles,
        text: (c) => fmtInt(c.miles),
        brief: (c) => fmtMilesShort(c.miles),
        mode: 'rail',
    },
    {
        id: 'routes-run',
        pct: 'routes',
        section: 'workload',
        value: (c) => c.routes,
        text: (c) => fmtInt(c.routes),
        mode: 'bus',
        boardOnly: true,
    },
];

const forGroup = (group: GroupId) => STATS.filter((s) => !s.mode || s.mode === GROUPS[group].mode);

/** Leaderboard columns for a line. */
export const boardStats = (group: GroupId): Stat[] => forGroup(group);

/** Percentile panel rows for one section. */
export const panelStats = (group: GroupId, section: Stat['section']): Stat[] =>
    forGroup(group).filter((s) => s.section === section && !s.boardOnly);
