import { describe, expect, it } from 'vitest';
import {
    doorLabel,
    fmtNum,
    ordinal,
    barEdge,
    EDGE_MIX,
    fmtDate,
    fmtPace,
    pace,
    pctColor,
    pctInk,
    signed,
    timeSaved,
} from './format';
import { GROUPS, isGroup } from './groups';
import { panelStats } from './stats';
import { car } from './test/fixtures';
import { contrast, hex, mix, rgbOf, WHITE } from './test/contrast';

describe('signed', () => {
    it('never shows a negative zero', () => {
        expect(signed(-0.04, 1)).toBe('0.0');
        expect(signed(0.04, 1)).toBe('0.0');
    });
    it('uses U+2212 for minus and + for plus', () => {
        expect(signed(-2.14, 1, ' s')).toBe('−2.1 s');
        expect(signed(2.86, 1, ' s')).toBe('+2.9 s');
    });
    it('handles null', () => expect(signed(null)).toBe('–'));
});

describe('car stats', () => {
    it('pace is speed_vs_avg_pct, shown as a signed percent', () => {
        expect(pace({ speed_vs_avg_pct: 2.54 })).toBe(2.54);
        expect(pace({ speed_vs_avg_pct: null })).toBeNull();
        expect(pace({})).toBeNull();
        expect(fmtPace(2.54)).toBe('+2.5%');
        expect(fmtPace(-1.26)).toBe('−1.3%');
    });
    it('fmtDate', () => {
        expect(fmtDate('2026-11-18')).toBe('Nov 18, 2026');
        expect(fmtDate(null)).toBe('–');
    });
    it('timeSaved negates ttoe_vs_avg_sec', () => {
        expect(timeSaved({ ttoe_vs_avg_sec: -2.9 })).toBe(2.9);
    });
    it('doorLabel', () => {
        expect(doorLabel(-2)).toBe('2.0 s quick');
        expect(doorLabel(0.84)).toBe('0.8 s slow');
        expect(doorLabel(0.04)).toBe('typical');
    });
});

describe('units', () => {
    const miles = (n: number) =>
        panelStats('red', 'workload')
            .find((s) => s.id === 'miles')
            ?.brief?.(car('1900', { miles: n }));

    it('formats with a unit, or a dash when missing', () => {
        expect(fmtNum(89.91, 1, '%')).toBe('89.9%');
        expect(fmtNum(null, 0, ' s')).toBe('–');
    });
    it('shortens miles from 1,000 up', () => {
        expect(miles(820.4)).toBe('820');
        expect(miles(51578)).toBe('51.6k');
    });
});

describe('pctColor', () => {
    it('hits the three anchors', () => {
        expect(pctColor(0)).toBe('rgb(50,96,180)');
        expect(pctColor(50)).toBe('rgb(200,200,200)');
        expect(pctColor(100)).toBe('rgb(214,41,41)');
    });
    it('clamps out-of-range input', () => {
        expect(pctColor(-5)).toBe(pctColor(0));
        expect(pctColor(140)).toBe(pctColor(100));
    });
});

describe('pctInk', () => {
    it('picks white on the saturated ends and black on the pale middle', () => {
        expect(pctInk(0)).toBe('#fff');
        expect(pctInk(50)).toBe('#000');
        expect(pctInk(100)).toBe('#fff');
    });
    it('keeps the number readable (4.5:1) at every percentile', () => {
        for (let p = 0; p <= 100; p++) {
            const ink = pctInk(p) === '#fff' ? WHITE : [0, 0, 0];
            expect(contrast(ink, rgbOf(pctColor(p))), `percentile ${p}`).toBeGreaterThanOrEqual(
                4.5
            );
        }
    });
});

describe('groups', () => {
    it('validates group ids', () => {
        expect(isGroup('red')).toBe(true);
        expect(isGroup('purple')).toBe(false);
        expect(GROUPS.bus.color).toBe('#ffc72c');
    });
    it('gives every group a label color that reads on its fill (4.5:1)', () => {
        const INK = '#1d2427'; // --color-ink

        for (const [id, g] of Object.entries(GROUPS)) {
            const text = g.onColor === 'text-white' ? WHITE : hex(INK);
            expect(contrast(text, hex(g.color)), id).toBeGreaterThanOrEqual(4.5);
        }
    });
});

describe('ordinal', () => {
    it('uses st/nd/rd/th with the teens as th', () => {
        expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 51, 100, 101, 111, 112].map(ordinal)).toEqual([
            '1st',
            '2nd',
            '3rd',
            '4th',
            '11th',
            '12th',
            '13th',
            '21st',
            '22nd',
            '23rd',
            '51st',
            '100th',
            '101st',
            '111th',
            '112th',
        ]);
        expect(ordinal(0)).toBe('0th');
    });
});

describe('barEdge', () => {
    it('outlines every line color at 3:1 against white, so a share bar keeps its shape', () => {
        const INK = hex('#1d2427'); // --color-ink

        for (const [id, g] of Object.entries(GROUPS)) {
            const edge = mix(hex(g.color), INK, EDGE_MIX);

            expect(contrast(edge, WHITE), id).toBeGreaterThanOrEqual(3);
        }
    });
    it('mixes the line color toward ink', () => {
        expect(barEdge('#ffc72c')).toBe(
            `color-mix(in srgb, #ffc72c ${EDGE_MIX}%, var(--color-ink))`
        );
    });
});
