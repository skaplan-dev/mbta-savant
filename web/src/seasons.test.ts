import { describe, expect, it } from 'vitest';
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
