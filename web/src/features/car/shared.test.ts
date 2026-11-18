import { describe, expect, it } from 'vitest';
import { marriedMate, noSeasonData, routeCounts } from './shared';

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

describe('noSeasonData', () => {
    it('names the car and the season once, and says what to do next', () => {
        expect(noSeasonData('Bus', '1210', '2025')).toBe(
            'Bus 1210 has no data for 2025. Pick another season above.'
        );
        expect(noSeasonData('Car', '1902', 'last30')).toBe(
            'Car 1902 has no data for Last 30 Days. Pick another season above.'
        );
    });
});
