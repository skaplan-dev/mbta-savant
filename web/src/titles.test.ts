import { describe, expect, it } from 'vitest';
import { carTitle, GLOSSARY_TITLE, HOME_TITLE, lineTitle, NOT_FOUND_TITLE } from './titles';

describe('titles', () => {
    it('names the car, its line, and the site', () => {
        expect(carTitle('red', '1902')).toBe('Car 1902 · Red Line · MBTA Savant');
        expect(carTitle('bus', '1400')).toBe('Bus 1400 · MBTA Savant');
    });
    it('names the season and line for a leaderboard', () => {
        expect(lineTitle('2026', 'red')).toBe('2026 Red Line Leaderboard · MBTA Savant');
        expect(lineTitle('last30', 'orange')).toBe(
            'Last 30 Days Orange Line Leaderboard · MBTA Savant'
        );
    });
    it('has fixed titles for the static pages', () => {
        expect(HOME_TITLE).toBe('MBTA Savant — every car, every trip');
        expect(GLOSSARY_TITLE).toBe('Stat Glossary · MBTA Savant');
        expect(NOT_FOUND_TITLE).toBe('Not found · MBTA Savant');
    });
});
