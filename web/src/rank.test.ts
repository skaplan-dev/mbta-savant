import { describe, expect, it } from 'vitest';
import { isRanked, unrankedReason } from './rank';

describe('rank', () => {
    it('explains unranked cars', () => {
        const ok = { ranked: true, qualified: true };
        expect(unrankedReason('red', ok)).toBeNull();
        expect(unrankedReason('mattapan', ok)).toBe('Mattapan cars aren’t ranked.');
        expect(unrankedReason('green', { ranked: false, qualified: false })).toBe(
            'Not in the vehicle roster, so not ranked.'
        );
        expect(unrankedReason('red', { ranked: true, qualified: false })).toBe('Not enough trips');
    });
    it('isRanked excludes mattapan', () => {
        expect(isRanked('mattapan', { ranked: true, qualified: true })).toBe(false);
        expect(isRanked('red', { ranked: true, qualified: true })).toBe(true);
    });
});
