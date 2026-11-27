import { describe, expect, it } from 'vitest';
import { linkSeason, matchCars, mergeIndexes } from './carSearch';
import { indexEntry } from './test/fixtures';

describe('mergeIndexes', () => {
    it('merges every window, preferring the newest, and records where each car lives', () => {
        const merged = mergeIndexes(
            ['2026', '2025', 'last30'],
            new Map([
                ['2026', [indexEntry('1900', { fleet_label: 'new' })]],
                ['2025', [indexEntry('1900', { fleet_label: 'old' }), indexEntry('1800')]],
                ['last30', [indexEntry('1400', { group: 'bus' }), indexEntry('1800')]],
            ])
        );

        expect(merged.map((m) => `${m.group}:${m.number}:${m.window}`)).toEqual([
            'bus:1400:last30',
            'red:1800:2025',
            'red:1900:2026',
        ]);
        expect(merged.find((m) => m.number === '1900')?.fleet_label).toBe('new');
    });
    it('puts a real season ahead of All-time, which lists every car', () => {
        const merged = mergeIndexes(
            ['career', '2026', 'last30'],
            new Map([
                ['career', [indexEntry('1900'), indexEntry('1800'), indexEntry('1400')]],
                ['2026', [indexEntry('1900')]],
                ['last30', [indexEntry('1800')]],
            ])
        );

        expect(merged.map((m) => `${m.number}:${m.window}`)).toEqual([
            '1400:career',
            '1800:last30',
            '1900:2026',
        ]);
    });
    it('skips windows that are missing or still loading', () => {
        expect(
            mergeIndexes(
                ['2026', '2025'],
                new Map([
                    ['2026', null],
                    ['2025', undefined],
                ])
            )
        ).toEqual([]);
    });
});

describe('matchCars', () => {
    const entries = mergeIndexes(
        ['2026'],
        new Map([
            [
                '2026',
                [
                    indexEntry('15'),
                    indexEntry('150'),
                    indexEntry('1500'),
                    indexEntry('150', { group: 'bus' }),
                ],
            ],
        ])
    );

    it('puts exact matches first, then numeric order, line order breaking ties', () => {
        expect(matchCars(entries, '150', 8).map((e) => e.car_id)).toEqual([
            'red:150',
            'bus:150',
            'red:1500',
        ]);
        expect(matchCars(entries, '1', 2)).toHaveLength(2);
    });
});

describe('linkSeason', () => {
    it('pins a season only when the car lacks data in the default window', () => {
        const [e] = mergeIndexes(['2025'], new Map([['2025', [indexEntry('1510')]]]));
        expect(linkSeason(e, '2026')).toBe('2025');
        expect(linkSeason(e, '2025')).toBeUndefined();
    });
    it('never links to All-time, even with a career index listing every car', () => {
        const merged = mergeIndexes(
            ['career', '2026', 'last30'],
            new Map([
                ['career', [indexEntry('1900'), indexEntry('1800'), indexEntry('1400')]],
                ['2026', [indexEntry('1900')]],
                ['last30', [indexEntry('1800')]],
            ])
        );
        const seasons = merged.map((e) => linkSeason(e, '2026'));

        expect(seasons).toEqual([undefined, 'last30', undefined]);
    });
});
