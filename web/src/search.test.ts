import { describe, expect, it } from 'vitest';
import { mergeIndexes, seasonParam, validateSeasonSearch } from './search';

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

describe('mergeIndexes', () => {
    const e = (group: string, number: string, label = 'x') => ({
        car_id: `${group}:${number}`,
        group,
        number,
        fleet_label: label,
    });
    it('merges every window, preferring the newest, and records where each car lives', () => {
        const merged = mergeIndexes(['2026', '2025', 'last30'], {
            '2026': [e('red', '1900', 'new')],
            '2025': [e('red', '1900', 'old'), e('red', '1800')],
            last30: [e('bus', '1400'), e('red', '1800')],
        });
        expect(merged.map((m) => `${m.group}:${m.number}:${m.window}`).sort()).toEqual([
            'bus:1400:last30',
            'red:1800:2025',
            'red:1900:2026',
        ]);
        expect(merged.find((m) => m.number === '1900')?.fleet_label).toBe('new');
    });
    it('skips windows that are missing or still loading', () => {
        expect(mergeIndexes(['2026', '2025'], { '2026': null, '2025': undefined })).toEqual([]);
    });
});
