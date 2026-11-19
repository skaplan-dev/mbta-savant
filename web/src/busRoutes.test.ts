import { describe, expect, it } from 'vitest';
import type { RouteIndexEntry } from './api';
import { matchRoutes, routeLabel, routeSeason, routeWindows } from './busRoutes';

const e = (route: string, ranked_cars = 10): RouteIndexEntry => ({
    route,
    buses: 20,
    ranked_cars,
    trips: 500,
});

const WINDOWS = ['2026', '2025', 'last30'];

describe('routeLabel', () => {
    it('names Silver Line routes and leaves the rest alone', () => {
        expect(routeLabel('741')).toBe('SL1');
        expect(routeLabel('746')).toBe('SLW');
        expect(routeLabel('28')).toBe('28');
        expect(routeLabel('34E')).toBe('34E');
    });
});

describe('routeSeason', () => {
    const indexes = new Map([
        ['2026', [e('28', 0)]],
        ['2025', [e('28', 12)]],
        ['last30', [e('28', 3), e('34E', 0)]],
    ]);
    const options = (route: string) => routeWindows(route, WINDOWS, indexes);

    it('keeps a requested season the route ran in', () => {
        expect(routeSeason('28', 'last30', options('28'), indexes)).toBe('last30');
    });
    it('prefers the newest year with a ranked bus', () => {
        expect(routeSeason('28', undefined, options('28'), indexes)).toBe('2025');
    });
    it('ignores a requested season the route did not run in', () => {
        expect(options('34E')).toEqual(['last30']);
        expect(routeSeason('34E', '2026', options('34E'), indexes)).toBe('last30');
    });
    it('has no season for a route that never ran', () => {
        expect(routeSeason('999', undefined, options('999'), indexes)).toBeUndefined();
    });
});

describe('matchRoutes', () => {
    const routes = [e('111'), e('741'), e('28'), e('1'), e('11')];

    it('sorts numerically, Silver Line by name', () => {
        expect(matchRoutes(routes, '').map((r) => r.route)).toEqual([
            '1',
            '11',
            '28',
            '111',
            '741',
        ]);
    });
    it('matches a route id or Silver Line name by prefix', () => {
        expect(matchRoutes(routes, '11').map((r) => r.route)).toEqual(['11', '111']);
        expect(matchRoutes(routes, 'sl').map((r) => r.route)).toEqual(['741']);
    });
});
