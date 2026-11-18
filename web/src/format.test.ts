import { describe, expect, it } from 'vitest';
import { doorLabel, GROUPS, isGroup, pacePlus, pctColor, signed, timeSaved } from './format';

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
    it('pacePlus rounds 100 + speed_vs_avg_pct', () => {
        expect(pacePlus({ speed_vs_avg_pct: 2.5, ttoe_vs_avg_sec: null })).toBe(103);
        expect(pacePlus({ speed_vs_avg_pct: null, ttoe_vs_avg_sec: null })).toBeNull();
    });
    it('timeSaved negates ttoe_vs_avg_sec', () => {
        expect(timeSaved({ ttoe_vs_avg_sec: -2.9, speed_vs_avg_pct: null })).toBe(2.9);
    });
    it('doorLabel', () => {
        expect(doorLabel(-2)).toBe('2 s quick');
        expect(doorLabel(3)).toBe('3 s slow');
        expect(doorLabel(0)).toBe('typical');
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

describe('groups', () => {
    it('validates group ids', () => {
        expect(isGroup('red')).toBe(true);
        expect(isGroup('purple')).toBe(false);
        expect(GROUPS.bus.color).toBe('#ffc72c');
    });
});
