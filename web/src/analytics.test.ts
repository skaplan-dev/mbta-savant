import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackPageViews, type NavigationSource, type Resolved } from './analytics';

function fakeRouter() {
    let listener: (e: Resolved) => void = () => {};
    const router: NavigationSource = {
        subscribe: (_event, fn) => {
            listener = fn;

            return () => {};
        },
    };

    return { router, emit: (e: Resolved) => listener(e) };
}

afterEach(() => {
    delete window.goatcounter;
});

describe('trackPageViews', () => {
    it('counts moves to a new page, but not the first load or a season switch', () => {
        const count = vi.fn<(vars: { path: string }) => void>();
        window.goatcounter = { count };
        const { router, emit } = fakeRouter();

        trackPageViews(router);
        emit({ toLocation: { pathname: '/' }, pathChanged: true }); // first load: count.js handles it
        emit({
            fromLocation: { pathname: '/' },
            toLocation: { pathname: '/car/red/1902' },
            pathChanged: true,
        });
        emit({
            fromLocation: { pathname: '/car/red/1902' },
            toLocation: { pathname: '/car/red/1902' },
            pathChanged: false,
        });

        expect(count.mock.calls).toEqual([[{ path: '/car/red/1902' }]]);
    });

    it('does nothing when the script is blocked or not loaded yet', () => {
        const { router, emit } = fakeRouter();

        trackPageViews(router);
        expect(() =>
            emit({
                fromLocation: { pathname: '/' },
                toLocation: { pathname: '/line/red' },
                pathChanged: true,
            })
        ).not.toThrow();
    });
});
