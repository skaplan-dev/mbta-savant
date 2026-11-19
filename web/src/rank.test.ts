import { describe, expect, it } from 'vitest';
import { isRanked, unrankedReason } from './rank';

describe('rank', () => {
    it('explains unranked cars', () => {
        const ok = { ranked: true, qualified: true };
        expect(unrankedReason('red', ok, 870)).toBeNull();
        expect(unrankedReason('mattapan', ok, 10)).toBe('Mattapan cars aren’t ranked.');
        expect(unrankedReason('green', { ranked: false, qualified: false }, 10)).toBe(
            'Not in the vehicle roster, so not ranked.'
        );
        expect(unrankedReason('red', { ranked: true, qualified: false }, 870)).toBe(
            'Not enough trips this season to be ranked (needs 870).'
        );
    });
    it('isRanked excludes mattapan', () => {
        expect(isRanked('mattapan', { ranked: true, qualified: true })).toBe(false);
        expect(isRanked('red', { ranked: true, qualified: true })).toBe(true);
    });
});
