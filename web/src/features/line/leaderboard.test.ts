import { describe, expect, it } from 'vitest';
import { carStats, groupFile } from '../../test/fixtures';
import { firstDir, rankCars, sortCars, splitCars } from './leaderboard';

const car = (number: string, saved: number, pctTtoe: number, steadiness: number | null) =>
    carStats(number, {
        travel_vs_typical_sec: saved,
        steadiness_sec: steadiness,
        pct: { travel_time_sec: pctTtoe },
    });

describe('leaderboard', () => {
    const cars = [car('1', 1, 30, 5), car('2', -3, 90, 20), car('3', -2, 80, null)];

    it('ranks by TAR percentile, then TAR, then number', () => {
        const t = (n: string, p: number | null, tar: number | null) =>
            carStats(n, { tar, pct: { tar: p } });
        expect(
            rankCars([t('1', 40, 5), t('2', 90, 1), t('3', 90, 9), t('4', null, 50)]).map(
                (c) => c.number
            )
        ).toEqual(['3', '2', '1', '4']);
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
    it('sorts by last seen, most recent first, never-seen last', () => {
        const seen = rankCars([
            carStats('1', { last_seen: '2026-01-05' }),
            carStats('2', { last_seen: null }),
            carStats('3', { last_seen: '2026-11-18' }),
        ]);
        const rows = sortCars(seen, { key: 'last-seen', dir: firstDir('last-seen', 'red') }, 'red');
        expect(rows.map((r) => r.car.number)).toEqual(['3', '1', '2']);
    });
    it('first click is best-first', () => {
        expect(firstDir('consistency', 'red')).toBe('asc');
        expect(firstDir('time-saved', 'red')).toBe('desc');
        expect(firstDir('car', 'red')).toBe('asc');
    });
    it('splits ranked from unranked cars with a reason; mattapan is never ranked', () => {
        const red = splitCars(
            'red',
            groupFile([carStats('4', { qualified: false, trips: 7 }), carStats('1')])
        );

        expect(red.ranked.map((c) => c.number)).toEqual(['1']);
        expect(red.unranked).toHaveLength(1);
        expect(red.unranked[0].reason).toBe('Not enough trips');
        expect(
            splitCars('mattapan', groupFile([carStats('9')], { group: 'mattapan' })).unranked[0]
                .reason
        ).toContain('Mattapan');
    });
});
