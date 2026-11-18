// Hand-written type guards for the JSON files the pipeline writes. Each file is checked once, at the
// fetch boundary, so the rest of the app can trust its types.

export type Guard<T> = (v: unknown) => v is T;

/** One guard per property; the compiler makes sure no field of T is left unchecked. */
export type Fields<T> = { [K in keyof T]-?: Guard<T[K]> };

export const isString = (v: unknown): v is string => String(v) === v;

export const isNumber = (v: unknown): v is number => Number(v) === v;

export const isBoolean = (v: unknown): v is boolean => v === true || v === false;

export const nullable =
    <T>(g: Guard<T>) =>
    (v: unknown): v is T | null =>
        v === null || g(v);

export const optional =
    <T>(g: Guard<T>) =>
    (v: unknown): v is T | undefined =>
        v === undefined || g(v);

export const arrayOf =
    <T>(g: Guard<T>) =>
    (v: unknown): v is T[] =>
        Array.isArray(v) && v.every(g);

export const pair =
    <A, B>(a: Guard<A>, b: Guard<B>) =>
    (v: unknown): v is [A, B] =>
        Array.isArray(v) && v.length === 2 && a(v[0]) && b(v[1]);

/** A JSON object (not an array). */
const isObject = (v: unknown): v is object => v instanceof Object && !Array.isArray(v);

export const record =
    <T>(g: Guard<T>) =>
    (v: unknown): v is Record<string, T> =>
        isObject(v) && Object.values(v).every(g);

export function fields<T>(spec: Fields<T>): Guard<T> {
    const checks: [string, Guard<unknown>][] = Object.entries(spec);

    return (v: unknown): v is T => {
        if (!isObject(v)) return false;
        const own = new Map<string, unknown>(Object.entries(v));

        return checks.every(([k, g]) => g(own.get(k)));
    };
}
