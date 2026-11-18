import { describe, expect, it } from 'vitest';
import type { CarStats } from '../../api';
import { firstDir, rankCars, sortCars, unrankedCars } from './leaderboard';

function car(number: string, o: Partial<CarStats> & { pct_ttoe?: number | null } = {}): CarStats {
    const { pct_ttoe, ...rest } = o;

    return {
        car_id: `red:${number}`,
        number,
        trips: 100,
        qualified: true,
        ranked: true,
        ttoe_vs_avg_sec: 0,
        steadiness_sec: 10,
        pct: { ttoe_sec: pct_ttoe ?? 50 } as CarStats['pct'],
        vehicle: { fleet_key: 'k', fleet_label: 'F' },
        ...rest,
    } as CarStats;
}

describe('leaderboard', () => {
    const cars = [
        car('1', { ttoe_vs_avg_sec: 1, pct_ttoe: 30, steadiness_sec: 5 }),
        car('2', { ttoe_vs_avg_sec: -3, pct_ttoe: 90, steadiness_sec: 20 }),
        car('3', { ttoe_vs_avg_sec: -2, pct_ttoe: 80, steadiness_sec: null }),
    ];

    it('ranks by Time Saved, best first', () => {
        expect(rankCars(cars).map((c) => c.number)).toEqual(['2', '3', '1']);
    });
    it('sorts a stat by displayed value in either direction, nulls last', () => {
        const ranked = rankCars(cars);
        const asc = sortCars(ranked, { key: 'consistency', dir: 'asc' }, 'red');
        expect(asc.map((r) => r.car.number)).toEqual(['1', '2', '3']);
        const desc = sortCars(ranked, { key: 'consistency', dir: 'desc' }, 'red');
        expect(desc.map((r) => r.car.number)).toEqual(['2', '1', '3']);
    });
    it("keeps each car's rank when re-sorted", () => {
        const rows = sortCars(rankCars(cars), { key: 'car', dir: 'asc' }, 'red');
        expect(rows.map((r) => [r.car.number, r.rank])).toEqual([
            ['1', 3],
            ['2', 1],
            ['3', 2],
        ]);
    });
    it('first click is best-first', () => {
        expect(firstDir('consistency', 'red')).toBe('asc');
        expect(firstDir('time-saved', 'red')).toBe('desc');
        expect(firstDir('car', 'red')).toBe('asc');
    });
    it('lists unranked cars with a reason; mattapan is never ranked', () => {
        const u = unrankedCars('red', [car('4', { qualified: false, trips: 7 }), car('1')], 870);
        expect(u).toHaveLength(1);
        expect(u[0].reason).toContain('870');
        expect(unrankedCars('mattapan', [car('9')], 1)[0].reason).toContain('Mattapan');
    });
});

import { defaultLineSeason } from './useLineData';

describe('defaultLineSeason', () => {
    const entry = (group: string, ranked: boolean) =>
        ({ group, qualified: ranked, ranked }) as never;

    const w = ['2026', '2025', 'last30'];
    it('picks the newest year with a ranked car, else last30', () => {
        expect(
            defaultLineSeason('red', w, {
                '2026': [entry('red', true)],
                '2025': [entry('red', true)],
            })
        ).toBe('2026');
        expect(
            defaultLineSeason('red', w, {
                '2026': [entry('red', false)],
                '2025': [entry('red', true)],
            })
        ).toBe('2025');
        expect(defaultLineSeason('mattapan', w, { '2026': [entry('mattapan', true)] })).toBe(
            'last30'
        );
    });
});
