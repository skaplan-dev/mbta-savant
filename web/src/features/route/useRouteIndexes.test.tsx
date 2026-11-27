import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRouteIndexes } from '../../queries';

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe('useRouteIndexes', () => {
    it('never requests a route index for All-time', async () => {
        const fetchMock = vi.fn((url: string) =>
            Promise.resolve(
                url === '/data/2026/routes/index.json'
                    ? new Response('[]', { headers: { 'content-type': 'application/json' } })
                    : new Response('', { status: 404 })
            )
        );
        vi.stubGlobal('fetch', fetchMock);
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

        const wrapper = ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        );

        const windows = ['career', '2026'];
        const { result } = renderHook(() => useRouteIndexes(windows), { wrapper });
        await waitFor(() => expect(result.current.pending).toBe(false));

        expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/data/2026/routes/index.json']);
        expect([...result.current.indexes.keys()]).toEqual(['2026']);
    });
});
