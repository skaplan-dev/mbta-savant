import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
    createMemoryHistory,
    createRootRoute,
    createRouter,
    RouterProvider,
} from '@tanstack/react-router';
import { afterEach, describe, expect, it } from 'vitest';
import SeasonToggle from './SeasonToggle';

afterEach(cleanup);

const many = ['career', '2026', '2025', '2024', '2019', 'last30'];

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

describe('SeasonToggle', () => {
    it('renders All-time and Last 30 Days links around a Year select, newest first', async () => {
        await setup(many, '2025');
        expect(await screen.findByRole('link', { name: 'All-time' })).toBeTruthy();
        expect(screen.getByRole('link', { name: 'Last 30 Days' })).toBeTruthy();
        const select = screen.getByRole('combobox', { name: 'Year' });
        const opts = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);

        expect(opts).toEqual(['2026', '2025', '2024', '2019']);
        expect(select).toHaveProperty('value', '2025');
    });

    it('selecting a year navigates, keeping other search params', async () => {
        const router = await setup(many, 'career');
        const select = await screen.findByRole('combobox', { name: 'Year' });

        fireEvent.change(select, { target: { value: '2024' } });
        await waitFor(() =>
            expect(router.state.location.search).toMatchObject({ season: '2024', foo: 'bar' })
        );
    });

    it('shows a Year placeholder and marks the link current for career / last30', async () => {
        await setup(many, 'career');
        const select = await screen.findByRole('combobox', { name: 'Year' });

        expect(select).toHaveProperty('value', '');
        expect(select.querySelector('option')?.textContent).toBe('Year');
        expect(screen.getByRole('link', { name: 'All-time' }).getAttribute('aria-current')).toBe(
            'page'
        );
        cleanup();
        await setup(many, 'last30');
        expect(
            (await screen.findByRole('link', { name: 'Last 30 Days' })).getAttribute('aria-current')
        ).toBe('page');
    });

    it('keeps plain links for three or fewer options', async () => {
        await setup(['2026', '2025', 'last30'], '2026');
        expect(await screen.findByRole('link', { name: '2025' })).toBeTruthy();
        expect(screen.queryByRole('combobox')).toBeNull();
    });

    it('shows the placeholder when the value is a year not in options', async () => {
        await setup(many, '2020');
        const select = await screen.findByRole('combobox', { name: 'Year' });

        expect(select).toHaveProperty('value', '');
        expect(select.className).not.toContain('bg-brand');
    });

    it('sorts years newest first regardless of input order', async () => {
        await setup(['career', '2019', '2026', '2024', 'last30'], '2026');
        const select = await screen.findByRole('combobox', { name: 'Year' });

        expect(Array.from(select.querySelectorAll('option')).map((o) => o.textContent)).toEqual([
            '2026',
            '2024',
            '2019',
        ]);
    });
});
