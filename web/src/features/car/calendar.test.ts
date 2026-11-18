import { describe, expect, it } from 'vitest';
import { dayScore, monthSummaries, savedShort, weekGrid, yearMonths } from './calendar';

describe('yearMonths', () => {
    it('lays out months Sunday-first and stops at the end date', () => {
        const m = yearMonths(2026, '2026-11-16');
        expect(m.map((x) => x.label)).toEqual([
            'JAN',
            'FEB',
            'MAR',
            'APR',
            'MAY',
            'JUN',
            'JUL',
            'AUG',
            'SEP',
            'OCT',
            'NOV',
        ]);
        // 2026-01-01 is a Thursday
        expect(m[0].days[0]).toEqual({ date: '2026-01-01', col: 4, row: 0, dayOfMonth: 1 });
        // 2026-01-04 is the first Sunday, second row
        expect(m[0].days[3]).toMatchObject({ date: '2026-01-04', col: 0, row: 1 });
        expect(m[0].days).toHaveLength(31);
        expect(m[10].days.at(-1)?.date).toBe('2026-11-16');
        // May 2026 starts on a Friday and needs six rows
        expect(Math.max(...m[4].days.map((d) => d.row))).toBe(5);
    });
    it('gives a full year when the end is past December', () => {
        expect(yearMonths(2025, '2025-12-31')).toHaveLength(12);
    });
});

describe('weekGrid', () => {
    it('covers last30 (Sun Oct 18 to Mon Nov 16) in five Sunday-first weeks', () => {
        const g = weekGrid('2026-10-18', '2026-11-16');
        expect(g.days).toHaveLength(30);
        expect(g.weeks).toBe(5);
        expect(g.days[0]).toEqual({ date: '2026-10-18', col: 0, row: 0, dayOfMonth: 18 });
        expect(g.days.at(-1)).toEqual({ date: '2026-11-16', col: 1, row: 4, dayOfMonth: 16 });
    });
});

describe('dayScore and monthSummaries', () => {
    it('scores faster days higher', () => {
        expect(dayScore(5, 8)).toBe(68);
        expect(dayScore(null, 8)).toBe(50);
    });
    it('rolls up months, ignoring null ttoe', () => {
        const s = monthSummaries([
            { date: '2026-04-01', trips: 10, miles: null, ttoe_sec: 4, routes: [] },
            { date: '2026-04-02', trips: 21, miles: null, ttoe_sec: null, routes: [] },
            { date: '2026-05-01', trips: 5, miles: null, ttoe_sec: 2, routes: [] },
        ]);
        expect(s).toEqual([
            { key: '2026-04', label: 'Apr', days: 2, tripsPerDay: 16, ttoe: 4 },
            { key: '2026-05', label: 'May', days: 1, tripsPerDay: 5, ttoe: 2 },
        ]);
    });
});

describe('savedShort', () => {
    it('drops the decimal once the value reaches 10 s', () => {
        expect(savedShort(2.34)).toBe('+2.3');
        expect(savedShort(-9.94)).toBe('−9.9');
        expect(savedShort(-9.96)).toBe('−10');
        expect(savedShort(-12.4)).toBe('−12');
    });
});
