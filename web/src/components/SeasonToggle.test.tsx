import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
    createMemoryHistory,
    createRootRoute,
    createRouter,
    RouterProvider,
} from '@tanstack/react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SeasonToggle from './SeasonToggle';

afterEach(cleanup);

// jsdom has no ResizeObserver; the menu only needs it to exist.
vi.stubGlobal(
    'ResizeObserver',
    class {
        observe() {}
        unobserve() {}
        disconnect() {}
    }
);

const many = ['career', '2019', '2026', '2024', '2025', 'last30'];

async function setup(options: string[], value: string, initial = '/?foo=bar') {
    const router = createRouter({
        routeTree: createRootRoute({
            component: () => <SeasonToggle options={options} value={value} />,
        }),
        history: createMemoryHistory({ initialEntries: [initial] }),
    });

    await router.load();
    render(<RouterProvider router={router} />);

    return router;
}

async function open(value: string) {
    fireEvent.click(await screen.findByRole('button', { name: `Season: ${value}` }));

    return screen.findAllByRole('menuitem');
}

describe('SeasonToggle', () => {
    it('shows the current season on the button', async () => {
        await setup(many, '2025');
        expect(await screen.findByRole('button', { name: 'Season: 2025' })).toBeTruthy();
    });

    it('lists All-time, years newest first, then Last 30 Days', async () => {
        await setup(many, 'career');
        const items = await open('All-time');

        expect(items.map((i) => i.textContent)).toEqual([
            'All-time',
            '2026',
            '2025',
            '2024',
            '2019',
            'Last 30 Days',
        ]);
    });

    it('marks the current season', async () => {
        await setup(many, '2024');
        const items = await open('2024');
        const current = items.filter((i) => i.getAttribute('aria-current') === 'page');

        expect(current.map((i) => i.textContent)).toEqual(['2024']);
    });

    it('choosing a season navigates, keeping other search params', async () => {
        const router = await setup(many, 'career');
        const items = await open('All-time');
        const target = items.find((i) => i.textContent === '2024');

        expect(target).toBeTruthy();
        if (target) fireEvent.click(target);
        await waitFor(() =>
            expect(router.state.location.search).toMatchObject({ season: '2024', foo: 'bar' })
        );
    });

    it('omits seasons not offered (bus routes have no All-time)', async () => {
        await setup(['2026', '2025', 'last30'], '2026');
        const items = await open('2026');

        expect(items.map((i) => i.textContent)).toEqual(['2026', '2025', 'Last 30 Days']);
    });

    it('marks nothing when the value is a year not offered', async () => {
        await setup(many, '2020');
        const items = await open('2020');

        expect(items.some((i) => i.getAttribute('aria-current') === 'page')).toBe(false);
    });
});
