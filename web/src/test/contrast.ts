// WCAG relative luminance and contrast, for checking text and graphics on a colored fill.
const channel = (c: number) => {
    const s = c / 255;

    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const luminance = (rgb: number[]) =>
    0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);

export const WHITE = [255, 255, 255];

export const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

export const rgbOf = (css: string) => (css.match(/\d+/g) ?? []).map(Number);

export const contrast = (a: number[], b: number[]) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);

    return (hi + 0.05) / (lo + 0.05);
};

/** `share`% of `a` plus the rest `b`, like CSS color-mix(in srgb). */
export const mix = (a: number[], b: number[], share: number) =>
    a.map((x, i) => Math.round((x * share + b[i] * (100 - share)) / 100));
