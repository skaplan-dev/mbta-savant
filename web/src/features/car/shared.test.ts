import { describe, expect, it } from 'vitest';
import { marriedMate, routeCounts, unrankedReason } from './shared';

describe('car helpers', () => {
    it('finds a married pair at 95% shared trips', () => {
        expect(marriedMate({ trips: 100, teammates: [['1903', 95]] })).toBe('1903');
        expect(marriedMate({ trips: 100, teammates: [['1903', 94]] })).toBeNull();
        expect(marriedMate({ trips: 0, teammates: [] })).toBeNull();
    });
    it('counts route days', () => {
        const log = [
            { date: 'a', trips: 1, miles: null, ttoe_sec: null, routes: ['28', '39'] },
            { date: 'b', trips: 1, miles: null, ttoe_sec: null, routes: ['39'] },
        ];
        expect(routeCounts({ game_log: log })).toEqual([
            { route: '39', days: 2 },
            { route: '28', days: 1 },
        ]);
    });
    it('explains unranked cars', () => {
        const ok = { ranked: true, qualified: true };
        expect(unrankedReason('red', ok, 870)).toBeNull();
        expect(unrankedReason('mattapan', ok, 10)).toBe('Mattapan cars aren’t ranked.');
        expect(unrankedReason('green', { ranked: false, qualified: false }, 10)).toBe(
            'Not in the vehicle roster, so not ranked.'
        );
        expect(unrankedReason('red', { ranked: true, qualified: false }, 870)).toBe(
            'Not enough trips this season to be ranked (needs 870).'
        );
    });
});
