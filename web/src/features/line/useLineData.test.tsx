import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useLineData } from './useLineData';

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

const META = {
    generated_at: '2026-11-18T05:00:00+00:00',
    windows: [{ key: '2026', start: '2026-01-01', end: '2026-12-31' }],
    latest_service_date: '2026-11-17',
};

const GROUP = {
    group: 'red',
    window: '2026',
    generated_at: META.generated_at,
    qualify_min_trips: 50,
    averages: { ttoe_sec: 0, speed_vs_expected_pct: 0 },
    cars: [],
};

const FLEETS = { '2026': { crrc: { fleet_label: 'Red Line #4 (CRRC)', cars: 66, median: {} } } };

const json = (body: typeof META | typeof GROUP | typeof FLEETS) =>
    new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

/** Serves meta and the group file at once; `fleets` is whatever the test wants that request to do. */
function serve(fleets: () => Promise<Response>) {
    vi.stubGlobal(
        'fetch',
        vi.fn((url: string) => {
            if (url === '/data/meta.json') return Promise.resolve(json(META));

            if (url === '/data/2026/groups/red.json') return Promise.resolve(json(GROUP));

            if (url === '/data/fleets/red.json') return fleets();

            return Promise.resolve(new Response('', { status: 404 }));
        })
    );
}

function render() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    return renderHook(() => useLineData('red', '2026'), { wrapper });
}

describe('useLineData fleets', () => {
    it('keeps the page loading until fleets arrive, so the strip never pops in above the table', async () => {
        serve(() => new Promise<Response>(() => {}));
        const { result } = render();

        await waitFor(() => expect(fetch).toHaveBeenCalledWith('/data/2026/groups/red.json'));
        await new Promise((r) => setTimeout(r, 50));
        expect(result.current.status).toBe('loading');
    });
    it('requests fleets at the same time as the rest, not after the group file', async () => {
        serve(() => new Promise<Response>(() => {}));
        render();

        await waitFor(() => expect(fetch).toHaveBeenCalledWith('/data/fleets/red.json'));
        expect(fetch).toHaveBeenCalledWith('/data/meta.json');
    });
    it('hands the fleets to the page once everything is in', async () => {
        serve(() => Promise.resolve(json(FLEETS)));
        const { result } = render();

        await waitFor(() => expect(result.current.status).toBe('ready'));
        expect(result.current.status === 'ready' && result.current.data.fleets).toEqual(FLEETS);
    });
    it('shows the page without fleets when that file is missing', async () => {
        serve(() => Promise.resolve(new Response('', { status: 404 })));
        const { result } = render();

        await waitFor(() => expect(result.current.status).toBe('ready'));
        expect(result.current.status === 'ready' && result.current.data.fleets).toBeNull();
    });
});
