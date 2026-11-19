import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { carStats } from '../../test/fixtures';
import { renderWithRouter } from '../../test/router';
import LeaderboardTable from './LeaderboardTable';

afterEach(cleanup);

// jsdom has no ResizeObserver; the virtualized board only needs it to exist.
vi.stubGlobal(
    'ResizeObserver',
    class {
        observe() {}
        unobserve() {}
        disconnect() {}
    }
);

describe('LeaderboardTable', () => {
    it('keeps keyboard focus on a sort button after activating it', async () => {
        await renderWithRouter(
            <LeaderboardTable
                group="red"
                season="2026"
                ranked={[
                    carStats('1', { ttoe_vs_avg_sec: 1 }),
                    carStats('2', { ttoe_vs_avg_sec: -2 }),
                ]}
            />
        );
        const btn = await screen.findByRole('button', { name: 'Sort by trips' });
        btn.focus();
        expect(document.activeElement).toBe(btn);
        fireEvent.click(btn);
        expect(screen.getByRole('button', { name: 'Sort by trips' })).toBe(btn);
        expect(document.activeElement).toBe(btn);
    });

    it('shows which way a column is sorted with a library chevron, and a neutral one when it is not', async () => {
        await renderWithRouter(
            <LeaderboardTable
                group="red"
                season="2026"
                ranked={[carStats('1'), carStats('2', { trips: 200 })]}
            />
        );

        const icon = () =>
            screen.getByRole('button', { name: 'Sort by trips' }).querySelector('svg');

        expect(icon()?.getAttribute('class')).toContain('lucide-chevrons-up-down');

        fireEvent.click(screen.getByRole('button', { name: 'Sort by trips' }));
        const first = icon()?.getAttribute('class') ?? '';

        expect(first).toMatch(/lucide-chevron-(up|down)\b/);

        fireEvent.click(screen.getByRole('button', { name: 'Sort by trips' }));
        const second = icon()?.getAttribute('class') ?? '';

        expect(second).toMatch(/lucide-chevron-(up|down)\b/);
        expect(second).not.toBe(first);
    });

    it('renders every row of a small board but only a window of a big one', async () => {
        const cars = (n: number) => Array.from({ length: n }, (_, i) => carStats(String(1000 + i)));
        const bodyRows = () => document.querySelectorAll('tbody tr[data-index]').length;

        await renderWithRouter(<LeaderboardTable group="red" season="2026" ranked={cars(50)} />);
        await screen.findByText('1049');
        expect(bodyRows()).toBe(50);
        cleanup();

        // jsdom lays nothing out; give rows a real height so the window holds a realistic count.
        const height = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(41);

        await renderWithRouter(<LeaderboardTable group="bus" season="2026" ranked={cars(1000)} />);
        await screen.findByText('1000');
        expect(bodyRows()).toBeGreaterThan(10);
        expect(bodyRows()).toBeLessThan(100);
        height.mockRestore();
    });
});
