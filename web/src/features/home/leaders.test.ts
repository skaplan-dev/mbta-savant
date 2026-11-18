import { describe, expect, it } from 'vitest';
import type { IndexEntry } from '../../api';
import { topLeaders } from './leaders';

const e = (number: string, vs: number | null, o: Partial<IndexEntry> = {}): IndexEntry => ({
    car_id: `red:${number}`,
    group: 'red',
    number,
    fleet_label: 'F',
    qualified: true,
    ranked: true,
    ttoe_sec: 1,
    ttoe_vs_avg_sec: vs,
    pct_ttoe: 50,
    ...o,
});

describe('topLeaders', () => {
    it('takes the five most-negative ttoe_vs_avg_sec (most time saved) among ranked cars', () => {
        const idx = [
            e('1', 1),
            e('2', -4),
            e('3', -1),
            e('4', -9, { qualified: false }),
            e('5', -3),
            e('6', -2),
            e('7', -5),
            e('8', null),
            e('9', -8, { group: 'bus' }),
        ];

        expect(topLeaders(idx, 'red').map((x) => x.number)).toEqual(['7', '2', '5', '6', '3']);
    });
    it('never ranks mattapan', () => {
        expect(topLeaders([e('3001', -1, { group: 'mattapan' })], 'mattapan')).toEqual([]);
    });
});
