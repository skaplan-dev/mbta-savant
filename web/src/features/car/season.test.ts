import { describe, expect, it } from 'vitest';
import { defaultSeason, orderWindows, resolveSeason } from './season';

const keys = ['last30', '2026', '2025'];
const ranked = { qualified: true, ranked: true };
const unranked = { qualified: false, ranked: true };

describe('season choice', () => {
    it('orders years newest first, then last30', () => {
        expect(orderWindows(keys)).toEqual(['2026', '2025', 'last30']);
    });
    it('prefers the newest ranked year', () => {
        expect(defaultSeason(keys, { 2026: ranked, 2025: ranked, last30: ranked })).toBe('2026');
        expect(defaultSeason(keys, { 2026: unranked, 2025: ranked })).toBe('2025');
    });
    it('falls back to the newest year with a file, then last30', () => {
        expect(defaultSeason(keys, { 2026: unranked, 2025: unranked })).toBe('2026');
        expect(defaultSeason(keys, { 2026: null, 2025: unranked })).toBe('2025');
        expect(defaultSeason(keys, { 2026: null, 2025: null, last30: unranked })).toBe('last30');
        expect(defaultSeason(keys, { 2026: null, 2025: null, last30: null })).toBeUndefined();
    });
    it('honors a known requested window, even one the car lacks', () => {
        expect(resolveSeason('2025', keys, { 2026: ranked, 2025: null })).toBe('2025');
        expect(resolveSeason('1999', keys, { 2026: ranked })).toBe('2026');
        expect(resolveSeason(undefined, keys, { 2026: ranked })).toBe('2026');
    });
});
