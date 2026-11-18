import { describe, expect, it } from 'vitest';
import { parseSearch } from './search';
import { isYearKey, orderWindows, resolveSeason, validateSeasonSearch } from './seasons';

describe('validateSeasonSearch', () => {
    it('accepts years and last30', () => {
        expect(validateSeasonSearch({ season: '2026' })).toEqual({ season: '2026' });
        expect(validateSeasonSearch({ season: 'last30' })).toEqual({ season: 'last30' });
    });
    it('drops anything else', () => {
        expect(validateSeasonSearch({ season: 'nope' })).toEqual({});
        expect(validateSeasonSearch({})).toEqual({});
    });
});

describe('season in a real URL', () => {
    // The router's decoder turns ?season=2025 into the number 2025, which once made every year
    // deep link fall back to the default season.
    const fromUrl = (query: string) => validateSeasonSearch(parseSearch(query));

    it('keeps a year from the query string as a string', () => {
        expect(fromUrl('?season=2025')).toEqual({ season: '2025' });
        expect(fromUrl('?season=last30')).toEqual({ season: 'last30' });
        expect(fromUrl('?season=2025&tab=mates')).toEqual({ season: '2025' });
    });
    it('drops values that are not a season', () => {
        expect(fromUrl('?season=20x5')).toEqual({});
        expect(fromUrl('?season=2025.5')).toEqual({});
        expect(fromUrl('?season=12345')).toEqual({});
        expect(fromUrl('')).toEqual({});
    });
    it('resolves a year deep link to that year, even one the car has no data for', () => {
        const windows = orderWindows(['last30', '2026', '2025']);

        expect(resolveSeason(fromUrl('?season=2025').season, windows, () => false)).toBe('2025');
    });
});

describe('season windows', () => {
    const keys = ['last30', '2026', '2025'];

    it('orders years newest first, then last30', () => {
        expect(orderWindows(keys)).toEqual(['2026', '2025', 'last30']);
        expect(orderWindows(['2025', 'odd'])).toEqual(['2025']);
    });
    it('honors a known requested window, else the first preference that matches', () => {
        const w = orderWindows(keys);
        expect(resolveSeason('2025', w, () => false)).toBe('2025');
        expect(resolveSeason('1999', w, (k) => k === '2025')).toBe('2025');
        expect(
            resolveSeason(
                undefined,
                w,
                () => false,
                (k) => !isYearKey(k)
            )
        ).toBe('last30');
        expect(resolveSeason(undefined, w, () => false)).toBeUndefined();
    });
});
