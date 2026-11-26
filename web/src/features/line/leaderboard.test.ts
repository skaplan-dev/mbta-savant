import { describe, expect, it } from 'vitest';
import { carStats, groupFile } from '../../test/fixtures';
import { firstDir, rankCars, sortCars, splitCars } from './leaderboard';

const car = (number: string, saved: number, pctTtoe: number, steadiness: number | null) =>
    carStats(number, {
        travel_vs_typical_sec: saved,
        steadiness_sec: steadiness,
        tar: -saved,
        pct: { travel_time_sec: pctTtoe, tar: pctTtoe },
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
    it('breaks a TAR tie by Time Saved before car number', () => {
        const t = (n: string, saved: number | null) =>
            carStats(n, {
                tar: 10,
                travel_vs_typical_sec: saved == null ? null : -saved,
                pct: { tar: 50 },
            });

        expect(
            rankCars([t('1', 2), t('2', 9), t('3', null), t('4', 9)]).map((c) => c.number)
        ).toEqual(['2', '4', '1', '3']);
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
    it('on career sorts Time Saved by % vs typical, not seconds', () => {
        const c = (n: string, sec: number, pct: number) =>
            carStats(n, { travel_vs_typical_sec: sec, travel_vs_typical_pct: pct });
        const ranked = [c('1', -50, 1), c('2', 50, -4), c('3', 0, -2)];
        const key = { key: 'time-saved', dir: 'desc' } as const;

        expect(sortCars(ranked, key, 'red').map((r) => r.car.number)).toEqual(['1', '3', '2']);
        expect(sortCars(ranked, key, 'red', true).map((r) => r.car.number)).toEqual([
            '2',
            '3',
            '1',
        ]);
    });
    it('sorts the career Seasons column, most first', () => {
        const c = (n: string, s: number | null) => carStats(n, { seasons_played: s });
        const rows = sortCars(
            [c('1', 2), c('2', 9), c('3', null)],
            { key: 'seasons', dir: firstDir('seasons', 'red', true) },
            'red',
            true
        );

        expect(rows.map((r) => r.car.number)).toEqual(['2', '1', '3']);
    });
});
