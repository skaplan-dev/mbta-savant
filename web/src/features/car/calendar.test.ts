import { describe, expect, it } from 'vitest';
import { contrast, hex, rgbOf, WHITE } from '../../test/contrast';
import { dayColors, dayScore, dayText, monthSummaries, weekGrid, yearMonths } from './calendar';

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
        expect(dayScore(100, 100, 16)).toBe(50);
        expect(dayScore(84, 100, 16)).toBe(56);
        expect(dayScore(null, 100, 16)).toBe(50);
        expect(dayScore(100, null, 16)).toBe(50);
        expect(dayScore(100, 100, null)).toBe(50);
    });
    it('rolls up months, ignoring null trip time', () => {
        const s = monthSummaries([
            { date: '2026-04-01', trips: 10, miles: null, travel_time_sec: 4, routes: [] },
            { date: '2026-04-02', trips: 21, miles: null, travel_time_sec: null, routes: [] },
            { date: '2026-05-01', trips: 5, miles: null, travel_time_sec: 2, routes: [] },
        ]);

        expect(s).toEqual([
            { key: '2026-04', label: 'Apr', days: 2, tripsPerDay: 16, trip: 4 },
            { key: '2026-05', label: 'May', days: 1, tripsPerDay: 5, trip: 2 },
        ]);
    });
});

describe('dayColors', () => {
    const day = (travel_time_sec: number | null) => ({
        date: '2026-03-02',
        trips: 20,
        miles: 100,
        travel_time_sec,
        routes: ['Red'],
    });

    it('keeps a day number readable (4.5:1) on every fill the calendar can draw', () => {
        const typical = 100;

        for (let saved = -30; saved <= 30; saved += 0.5) {
            const { fill, ink } = dayColors(day(typical - saved), typical, 1);
            const text = ink === '#fff' ? WHITE : [0, 0, 0];

            expect(contrast(text, rgbOf(fill)), `${saved} s saved`).toBeGreaterThanOrEqual(4.5);
        }
    });
    it('falls back to the neutral middle when the line average is unknown', () => {
        const { fill, ink } = dayColors(day(95), null, 16);

        expect(fill).toBe('rgb(200,200,200)');
        expect(ink).toBe('#000');
    });
    it('draws a day that did not run in the track color, with a number that still reads', () => {
        const { fill, ink } = dayColors(undefined, 100, 16);

        expect(fill).toBe('var(--color-track)');
        // --color-track and --color-ink-2
        expect(contrast(hex('#4d5a5f'), hex('#dde7ea'))).toBeGreaterThanOrEqual(4.5);
        expect(ink).toBe('var(--color-ink-2)');
    });
});

describe('dayText', () => {
    const day = { date: '2026-03-02', trips: 20, miles: 100, travel_time_sec: 84, routes: ['Red'] };

    it('says what happened on a day that ran', () => {
        expect(dayText('2026-03-02', day, 100)).toBe(
            '2026-03-02 · 20 trips · +16 s saved per trip'
        );
    });
    it('leaves out the time when there is nothing to compare it with', () => {
        expect(dayText('2026-03-02', day, null)).toBe('2026-03-02 · 20 trips');
        expect(dayText('2026-03-02', { ...day, travel_time_sec: null }, 100)).toBe(
            '2026-03-02 · 20 trips'
        );
    });
    it('says so when the car did not run', () => {
        expect(dayText('2026-03-03', undefined, 100)).toBe('2026-03-03 · did not run');
    });
});
