import type { Car, CarStats } from './api';

// percentile -> Savant-style blue, gray, red
export function pctColor(p: number): string {
    const blue = [50, 96, 180],
        gray = [200, 200, 200],
        red = [214, 41, 41];
    const t = Math.max(0, Math.min(100, p)) / 100;
    const [a, b, u] = t < 0.5 ? [blue, gray, t / 0.5] : [gray, red, (t - 0.5) / 0.5];
    return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * u)).join(',')})`;
}

export const fmtNum = (v: number | null | undefined, digits = 1): string =>
    v == null
        ? '–'
        : v.toLocaleString('en-US', {
              minimumFractionDigits: digits,
              maximumFractionDigits: digits,
          });

// "+2.9 s", "−2.1 s"; a value that rounds to zero shows "0.0" with no sign.
export function signed(v: number | null | undefined, digits = 1, unit = ''): string {
    if (v == null) return '–';
    const body = fmtNum(Math.abs(v), digits);
    const isZero = Number(body.replace(/,/g, '')) === 0;
    return `${isZero ? '' : v > 0 ? '+' : '−'}${body}${unit}`;
}

type CarLike = Pick<CarStats, 'ttoe_vs_avg_sec' | 'speed_vs_avg_pct'> | Car;

// Seconds saved per stop vs the line's average car (positive = faster).
export function timeSaved(car: CarLike): number | null {
    return car.ttoe_vs_avg_sec == null ? null : -car.ttoe_vs_avg_sec;
}

// Speed on a 100 scale (100 = the line's average car).
export function pacePlus(car: CarLike): number | null {
    return car.speed_vs_avg_pct == null ? null : Math.round(100 + car.speed_vs_avg_pct);
}

export function doorLabel(sec: number | null | undefined): string {
    if (sec == null) return '–';
    if (sec === 0) return 'typical';
    return `${Math.abs(sec)} s ${sec < 0 ? 'quick' : 'slow'}`;
}

export type GroupId = 'red' | 'orange' | 'blue' | 'green' | 'mattapan' | 'bus';

export const GROUPS: Record<GroupId, { name: string; color: string }> = {
    red: { name: 'Red Line', color: '#da291c' },
    orange: { name: 'Orange Line', color: '#ed8b00' },
    blue: { name: 'Blue Line', color: '#003da5' },
    green: { name: 'Green Line', color: '#00843d' },
    mattapan: { name: 'Mattapan Line', color: '#7a8b8f' },
    bus: { name: 'Bus', color: '#ffc72c' },
};

export const GROUP_IDS = Object.keys(GROUPS) as GroupId[];
export const isGroup = (g: string): g is GroupId => Object.hasOwn(GROUPS, g);

export const seasonLabel = (k: string): string => (k === 'last30' ? 'Last 30 Days' : k);
