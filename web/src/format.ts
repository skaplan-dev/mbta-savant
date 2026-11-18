import type { CarStats } from './api';

// percentile -> Savant-style blue, gray, red
export function pctColor(p: number): string {
    const blue = [50, 96, 180],
        gray = [200, 200, 200],
        red = [214, 41, 41];

    const t = Math.max(0, Math.min(100, p)) / 100;
    const [a, b, u] = t < 0.5 ? [blue, gray, t / 0.5] : [gray, red, (t - 0.5) / 0.5];

    return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * u)).join(',')})`;
}

/** Value-cell tint from a percentile color; the same blue-gray-red scale, lightened. */
export const tint = (color: string) => `color-mix(in srgb, ${color} 35%, white)`;

export const fmtNum = (v: number | null | undefined, digits = 1): string =>
    v == null
        ? '–'
        : v.toLocaleString('en-US', {
              minimumFractionDigits: digits,
              maximumFractionDigits: digits,
          });

export const fmtInt = (v: number | null | undefined) => fmtNum(v, 0);

/** "89.9%", "6 s"; a missing value is a bare dash. */
export const fmtUnit = (v: number | null | undefined, digits: number, unit: string) =>
    v == null ? '–' : `${fmtNum(v, digits)}${unit}`;

/** "820", then "51.6k" from 1,000 up. */
export const fmtMilesShort = (v: number | null) =>
    v == null ? '–' : v < 1000 ? fmtInt(v) : `${(v / 1000).toFixed(1)}k`;

// "+2.9 s", "−2.1 s"; a value that rounds to zero shows "0.0" with no sign.
export function signed(v: number | null | undefined, digits = 1, unit = ''): string {
    if (v == null) return '–';
    const body = fmtNum(Math.abs(v), digits);
    const isZero = Number(body.replace(/,/g, '')) === 0;

    return `${isZero ? '' : v > 0 ? '+' : '−'}${body}${unit}`;
}

export const fmtSaved = (v: number | null | undefined) => signed(v, 1, ' s');

/** Whole-number share of `total`, e.g. 21 for 21%. */
export const pctOf = (part: number, total: number) => Math.round((part / total) * 100);

// Accept fleet medians as well as cars, so every surface derives these the same way.
type VsAverage = Partial<Pick<CarStats, 'ttoe_vs_avg_sec' | 'speed_vs_avg_pct'>>;

// Seconds saved per stop vs the line's average car (positive = faster).
export const timeSaved = ({ ttoe_vs_avg_sec: v }: VsAverage): number | null =>
    v == null ? null : -v;

// Speed on a 100 scale (100 = the line's average car).
export const pacePlus = ({ speed_vs_avg_pct: v }: VsAverage): number | null =>
    v == null ? null : Math.round(100 + v);

export function doorLabel(sec: number | null | undefined): string {
    if (sec == null) return '–';

    if (sec === 0) return 'typical';

    return `${Math.abs(sec)} s ${sec < 0 ? 'quick' : 'slow'}`;
}

/** 1 → "1st", 22 → "22nd", 11 → "11th". */
export function ordinal(n: number): string {
    const r100 = n % 100;

    if (r100 >= 11 && r100 <= 13) return `${n}th`;

    return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}
