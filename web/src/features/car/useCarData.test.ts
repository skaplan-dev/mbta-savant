import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CareerCar, Meta } from '../../api';
import type { Resource } from '../../resource';
import { car, careerCar, seasonRow } from '../../test/fixtures';
import { useCarData, type CarData } from './useCarData';

const meta: Meta = {
    generated_at: '',
    latest_service_date: '2026-11-16',
    windows: [
        { key: 'career', start: '2019-01-01', end: '2026-11-16' },
        { key: 'last30', start: '2026-10-18', end: '2026-11-16' },
        { key: '2026', start: '2026-01-01', end: '2026-12-31' },
        { key: '2021', start: '2021-01-01', end: '2021-12-31' },
        { key: '2019', start: '2019-01-01', end: '2019-12-31' },
    ],
};

const json = (body: unknown) => ({
    ok: true,
    headers: { get: () => 'application/json' },
    json: async () => body,
});

const notFound = { ok: false, headers: { get: () => 'text/html' }, json: async () => null };

let files: Record<string, unknown> = {};
let requested: string[] = [];

beforeEach(() => {
    requested = [];
    vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
            requested.push(url);
            const body = files[url];

            return body === undefined ? notFound : json(body);
        })
    );
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

const CAREER_URL = '/data/career/cars/red/1900.json';

function serve(career: CareerCar | undefined, years: string[]) {
    files = { '/data/meta.json': meta };
    if (career) files[CAREER_URL] = career;
    for (const y of years) files[`/data/${y}/cars/red/1900.json`] = car('1900');
}

/** Settled: the page has left `loading`, and when ready its season file has too. */
const settled = (r: Resource<CarData>) =>
    r.status !== 'loading' && (r.status !== 'ready' || r.data.seasonFile.status !== 'loading');

function mount(season: string | undefined) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client }, children);

    return renderHook((s: string | undefined) => useCarData('red', '1900', s), {
        wrapper,
        initialProps: season,
    });
}

async function load(season: string | undefined): Promise<Resource<CarData>> {
    const { result } = mount(season);

    await waitFor(() => expect(settled(result.current)).toBe(true));

    return result.current;
}

const carFileRequests = () => requested.filter((u) => u.includes('/cars/'));

const twoSeasons = (o: Partial<CareerCar> = {}) =>
    careerCar('1900', {
        last_seen: '2026-09-30',
        seasons: [seasonRow('2026'), seasonRow('2021')],
        ...o,
    });

describe('useCarData', () => {
    it('offers All-time and the car’s years, defaults to the newest ranked year, and fetches only two car files', async () => {
        serve(twoSeasons(), ['2026', '2021']);
        const r = await load(undefined);

        if (r.status !== 'ready') throw new Error(r.status);
        expect(r.data.options).toEqual(['career', '2026', '2021']);
        expect(r.data.season).toBe('2026');
        expect(r.data.seasonFile.status).toBe('ready');
        expect(carFileRequests()).toEqual([CAREER_URL, '/data/2026/cars/red/1900.json']);
    });

    it('skips a year where the car was not ranked', async () => {
        serve(twoSeasons({ seasons: [seasonRow('2026', { ranked: false }), seasonRow('2021')] }), [
            '2026',
            '2021',
        ]);
        const r = await load(undefined);

        if (r.status !== 'ready') throw new Error(r.status);
        expect(r.data.season).toBe('2021');
    });

    it('offers Last 30 Days when the car ran in that window', async () => {
        serve(twoSeasons({ last_seen: '2026-11-10' }), ['2026', '2021']);
        const r = await load(undefined);

        if (r.status !== 'ready') throw new Error(r.status);
        expect(r.data.options).toEqual(['career', '2026', '2021', 'last30']);
    });

    it('shows a requested season the car has no file for as empty, not an error', async () => {
        serve(twoSeasons(), ['2026', '2021']);
        const r = await load('2019');

        if (r.status !== 'ready') throw new Error(r.status);
        expect(r.data.season).toBe('2019');
        expect(r.data.seasonFile.status).toBe('missing');
        expect(carFileRequests()).toEqual([CAREER_URL, '/data/2019/cars/red/1900.json']);
    });

    it('uses the career record itself for All-time', async () => {
        serve(twoSeasons(), ['2026', '2021']);
        const r = await load('career');

        if (r.status !== 'ready') throw new Error(r.status);
        expect(r.data.season).toBe('career');
        expect(r.data.seasonFile).toEqual({ status: 'ready', data: r.data.career });
        expect(carFileRequests()).toEqual([CAREER_URL]);
    });

    it('keeps the page up while a newly picked season loads, never showing the old season as the new one', async () => {
        serve(twoSeasons(), ['2026', '2021']);
        const { result, rerender } = mount('2026');

        await waitFor(() => expect(settled(result.current)).toBe(true));

        // Hold the 2021 file until the test lets it through.
        let release = () => {};
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        const served = vi.mocked(fetch).getMockImplementation();

        vi.mocked(fetch).mockImplementation(async (input) => {
            if (typeof input === 'string' && input.includes('/2021/')) await gate;

            return served ? served(input) : Promise.reject(new Error('no fetch'));
        });

        rerender('2021');
        await waitFor(() => {
            const r = result.current;

            if (r.status !== 'ready') throw new Error(r.status);
            expect(r.data.season).toBe('2021');
            expect(r.data.seasonFile.status).toBe('loading');
        });

        release();
        await waitFor(() => {
            const r = result.current;

            if (r.status !== 'ready') throw new Error(r.status);
            expect(r.data.seasonFile.status).toBe('ready');
        });
    });

    it('is missing without a career file', async () => {
        serve(undefined, ['2026']);
        expect((await load(undefined)).status).toBe('missing');
    });
});
