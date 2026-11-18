import { parseSearchWith, stringifySearchWith } from '@tanstack/react-router';

const decode = parseSearchWith((v) => v);

export const parseSearch = (query: string): Record<string, string> =>
    Object.fromEntries(Object.entries(decode(query)).map(([key, value]) => [key, String(value)]));

export const stringifySearch = stringifySearchWith(String);
