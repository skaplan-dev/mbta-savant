/** "2" before "10": car numbers and route names sort as numbers where they can. */
export const compareNumeric = (a: string, b: string) =>
    a.localeCompare(b, undefined, { numeric: true });

export const byNumber = (a: { number: string }, b: { number: string }) =>
    compareNumeric(a.number, b.number);

export function compareNullsLast(a: number | null, b: number | null, dir: 'asc' | 'desc'): number {
    if (a == null && b == null) return 0;

    if (a == null) return 1;

    if (b == null) return -1;

    return dir === 'asc' ? a - b : b - a;
}
