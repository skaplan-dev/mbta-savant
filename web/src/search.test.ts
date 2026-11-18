import { describe, expect, it } from 'vitest';
import { seasonParam, validateSeasonSearch } from './search';

describe('validateSeasonSearch', () => {
    it('accepts years (number or string) and last30', () => {
        expect(validateSeasonSearch({ season: 2025 })).toEqual({ season: '2025' });
        expect(validateSeasonSearch({ season: '2026' })).toEqual({ season: '2026' });
        expect(validateSeasonSearch({ season: 'last30' })).toEqual({ season: 'last30' });
    });
    it('drops anything else', () => {
        expect(validateSeasonSearch({ season: 'nope' })).toEqual({});
        expect(validateSeasonSearch({})).toEqual({});
    });
    it('writes years as numbers', () => {
        expect(seasonParam('2026')).toBe(2026);
        expect(seasonParam('last30')).toBe('last30');
    });
});
