import { describe, expect, it } from 'vitest';
import { isRanked, lineSeason, unrankedReason } from './rank';
import { indexEntry } from './test/fixtures';

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

describe('lineSeason', () => {
    const red = (ranked: boolean) => indexEntry('1', { qualified: ranked, ranked });
    const w = ['2026', '2025', 'last30'];

    it('picks the newest year with a ranked car, else last30', () => {
        const both = new Map([
            ['2026', [red(true)]],
            ['2025', [red(true)]],
        ]);

        expect(lineSeason('red', undefined, w, both)).toBe('2026');

        const older = new Map([
            ['2026', [red(false)]],
            ['2025', [red(true)]],
        ]);

        expect(lineSeason('red', undefined, w, older)).toBe('2025');
        const mattapan = new Map([['2026', [indexEntry('3001', { group: 'mattapan' })]]]);
        expect(lineSeason('mattapan', undefined, w, mattapan)).toBe('last30');
    });
    it('honors a known requested season', () => {
        expect(lineSeason('red', '2025', w, new Map())).toBe('2025');
        expect(lineSeason('red', '1999', w, new Map())).toBe('last30');
    });
});
