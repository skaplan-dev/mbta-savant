import { describe, expect, it } from 'vitest';
import { marriedMate, routeCounts } from './shared';

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
});
