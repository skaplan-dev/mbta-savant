import type { CarStats } from './api';

function pctRgb(p: number): number[] {
    const blue = [50, 96, 180],
        gray = [200, 200, 200],
        red = [214, 41, 41];

    const t = Math.max(0, Math.min(100, p)) / 100;
    const [a, b, u] = t < 0.5 ? [blue, gray, t / 0.5] : [gray, red, (t - 0.5) / 0.5];

    return a.map((x, i) => Math.round(x + (b[i] - x) * u));
}

export const pctColor = (p: number): string => `rgb(${pctRgb(p).join(',')})`;

const channel = (c: number) => {
    const s = c / 255;

    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/**
 * White or black, whichever reads better on this percentile's fill. The middle of the scale is too
 * pale for white; black is used there (not the brand ink) because the best of white and ink dips to
 * about 4:1 near the 85th percentile, while white and pure black stay above 4.5:1 across the scale.
 */
export function pctInk(p: number): '#fff' | '#000' {
    const [r, g, b] = pctRgb(p);
    const l = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

    return 1.05 / (l + 0.05) >= (l + 0.05) / 0.05 ? '#fff' : '#000';
}

/**
 * Share of a line color kept in a share bar's outline, the rest being ink. The bars are drawn in a
 * pale tint of the line color; the outline keeps their shape visible (3:1) even for yellow on white.
 */
export const EDGE_MIX = 55;

export const barEdge = (color: string) =>
    `color-mix(in srgb, ${color} ${EDGE_MIX}%, var(--color-ink))`;

export const tint = (color: string) => `color-mix(in srgb, ${color} 35%, white)`;

/** "89.9%", "6 s"; a missing value is a bare dash. */
export const fmtNum = (v: number | null | undefined, digits = 1, unit = ''): string =>
    v == null
        ? '–'
        : v.toLocaleString('en-US', {
              minimumFractionDigits: digits,
              maximumFractionDigits: digits,
          }) + unit;

export const fmtInt = (v: number | null | undefined) => fmtNum(v, 0);

// "+2.9 s", "−2.1 s"; a value that rounds to zero shows "0.0" with no sign.
export function signed(v: number | null | undefined, digits = 1, unit = ''): string {
    if (v == null) return '–';
    const body = fmtNum(Math.abs(v), digits);
    const isZero = Number(body.replace(/,/g, '')) === 0;

    return `${isZero ? '' : v > 0 ? '+' : '−'}${body}${unit}`;
}

/** Time Saved and Dwell Time: whole seconds per trip. */
export const fmtSaved = (v: number | null | undefined) => signed(v, 0, ' s');

export const fmtSavedPct = (v: number | null | undefined) => signed(v, 1, '%');

export const pctOf = (part: number, total: number) => Math.round((part / total) * 100);

// Accept fleet medians as well as cars, so every surface derives these the same way.
type VsTypical = Partial<
    Pick<CarStats, 'travel_vs_typical_sec' | 'dwell_vs_typical_sec' | 'travel_vs_typical_pct'>
>;

const negate = (v: number | null | undefined): number | null => (v == null ? null : -v);

// Per trip vs the line's typical car; the data is centered with positive = slower, so these flip it (positive = faster).
export const timeSaved = (c: VsTypical) => negate(c.travel_vs_typical_sec);

export const dwellSaved = (c: VsTypical) => negate(c.dwell_vs_typical_sec);

export const savedPct = (c: VsTypical) => negate(c.travel_vs_typical_pct);

/** "Nov 18, 2026" from an ISO service date; a missing date is a bare dash. */
export const fmtDate = (iso: string | null | undefined): string =>
    iso
        ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
          })
        : '–';

export function ordinal(n: number): string {
    const r100 = n % 100;

    if (r100 >= 11 && r100 <= 13) return `${n}th`;

    return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

/** Where a percentile sits along the track: 0 at 8% and 100 at 92%, so the bubble stays inside it. */
export const barPos = (pct: number) => 8 + 0.84 * Math.max(0, Math.min(100, pct));
