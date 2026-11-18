import { describe, expect, it } from 'vitest';
import { indexEntry } from '../../test/fixtures';
import { topLeaders } from './leaders';

describe('topLeaders', () => {
    it('takes the five most-negative ttoe_vs_avg_sec (most time saved) among ranked cars', () => {
        const e = (number: string, vs: number | null, qualified = true) =>
            indexEntry(number, { ttoe_vs_avg_sec: vs, qualified });

        const idx = [
            e('1', 1),
            e('2', -4),
            e('3', -1),
            e('4', -9, false),
            e('5', -3),
            e('6', -2),
            e('7', -5),
            e('8', null),
        ];

        expect(topLeaders(idx).map((x) => x.number)).toEqual(['7', '2', '5', '6', '3']);
    });
    it('never ranks mattapan', () => {
        expect(
            topLeaders([indexEntry('3001', { group: 'mattapan', ttoe_vs_avg_sec: -1 })])
        ).toEqual([]);
    });
});
