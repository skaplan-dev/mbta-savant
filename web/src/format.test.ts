import { describe, expect, it } from 'vitest';
import {
    fmtNum,
    ordinal,
    barEdge,
    EDGE_MIX,
    fmtDate,
    fmtSaved,
    fmtSavedPct,
    dwellSaved,
    savedPct,
    pctColor,
    pctInk,
    signed,
    timeSaved,
} from './format';
import { GROUPS, isGroup } from './groups';
import { BOARD_ORDER, boardStats, panelStats, STATS } from './stats';
import { GLOSSARY, STAT_IDS } from './glossary';
import { car, carStats } from './test/fixtures';
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
    it('fmtSaved is whole seconds, signed', () => {
        expect(fmtSaved(31.6)).toBe('+32 s');
        expect(fmtSaved(-4.6)).toBe('−5 s');
        expect(fmtSaved(-0.4)).toBe('0 s');
        expect(fmtSaved(null)).toBe('–');
    });
    it('fmtSavedPct is one decimal', () => {
        expect(fmtSavedPct(1.84)).toBe('+1.8%');
        expect(fmtSavedPct(-1.26)).toBe('−1.3%');
    });
    it('saved values negate the centered fields', () => {
        expect(timeSaved({ travel_vs_typical_sec: -32 })).toBe(32);
        expect(dwellSaved({ dwell_vs_typical_sec: -3 })).toBe(3);
        expect(savedPct({ travel_vs_typical_pct: -1.8 })).toBe(1.8);
        expect(timeSaved({})).toBeNull();
        expect(dwellSaved({ dwell_vs_typical_sec: null })).toBeNull();
        expect(savedPct({})).toBeNull();
    });
    it('fmtDate', () => {
        expect(fmtDate('2026-11-18')).toBe('Nov 18, 2026');
        expect(fmtDate(null)).toBe('–');
    });
});

describe('stats registry', () => {
    it('orders the red board', () => {
        expect(boardStats('red').map((s) => s.id)).toEqual([
            'time-saved',
            'days-in-service',
            'iron-horse',
            'dwell-time',
            'consistency',
            'on-schedule',
            'miles',
        ]);
    });
    it('orders the bus board', () => {
        expect(
            boardStats('bus')
                .map((s) => s.id)
                .at(-1)
        ).toBe('routes-run');
    });
    it('panels keep registry order per section', () => {
        expect(panelStats('red', 'performance').map((s) => s.id)).toEqual([
            'time-saved',
            'dwell-time',
            'consistency',
            'on-schedule',
        ]);
        expect(panelStats('red', 'availability').map((s) => s.id)).toEqual([
            'days-in-service',
            'iron-horse',
            'miles',
        ]);
    });
    it('renders a dash for timing stats without data', () => {
        const c = carStats('1', {});
        for (const id of ['time-saved', 'dwell-time']) {
            expect(STATS.find((s) => s.id === id)?.text(c)).toBe('–');
        }
    });
    it('time saved shows seconds and percent on the board, seconds in the panel', () => {
        const c = carStats('1', { travel_vs_typical_sec: -32, travel_vs_typical_pct: -1.84 });
        const s = STATS.find((x) => x.id === 'time-saved');
        expect(s?.text(c)).toBe('+32 s · +1.8%');
        expect(s?.brief?.(c)).toBe('+32 s');
    });
    it('glossary matches the registry', () => {
        expect(STAT_IDS).not.toContain('pace-plus');
        const removed = 'travel-time'; // merged into Time Saved
        expect(STAT_IDS).not.toContain(removed);
        expect(STATS.map((s) => s.id)).not.toContain(removed);
        expect(Object.keys(GLOSSARY)).not.toContain(removed);
        expect(GLOSSARY['dwell-time'].name).toBe('Dwell Time');
        expect(GLOSSARY['last-seen'].section).toBe('availability');
    });
});

describe('units', () => {
    const miles = (n: number) =>
        panelStats('red', 'availability')
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

describe('BOARD_ORDER', () => {
    it('lists every stat so a new one cannot silently drop off the leaderboard', () => {
        expect(STATS.map((s) => s.id).filter((id) => !BOARD_ORDER.includes(id))).toEqual([]);
    });
});
