import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { carStats } from '../../test/fixtures';
import { renderWithRouter } from '../../test/router';
import { routeBoardStats } from '../../stats';
import LeaderboardTable from './LeaderboardTable';

afterEach(cleanup);

const five = ['1', '2', '3', '4', '5'].map((n) => carStats(n));

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
    it('shows stat values without percentile numbers', async () => {
        await renderWithRouter(
            <LeaderboardTable
                group="red"
                season="2026"
                ranked={[
                    carStats('1', { travel_vs_typical_sec: -32, pct: { travel_time_sec: 87 } }),
                ]}
            />
        );
        expect(await screen.findByText(/\+32 s/)).toBeTruthy();
        expect(screen.queryByText('87')).toBeNull();
    });
    it('keeps keyboard focus on a sort button after activating it', async () => {
        await renderWithRouter(
            <LeaderboardTable
                group="red"
                season="2026"
                ranked={[
                    carStats('1', { travel_vs_typical_sec: 1 }),
                    carStats('2', { travel_vs_typical_sec: -2 }),
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

    it('shows no close-race banner on a full board', async () => {
        await renderWithRouter(<LeaderboardTable group="red" season="2026" ranked={five} />);
        await screen.findByRole('table');
        expect(screen.queryByText(/Close race/)).toBeNull();
        expect(screen.queryByText(/percentiles are rough/)).toBeNull();
    });

    it('defaults to TAR descending', async () => {
        await renderWithRouter(
            <LeaderboardTable
                group="red"
                season="2026"
                ranked={[
                    carStats('1', { tar: -5 }),
                    carStats('2', { tar: 300 }),
                    carStats('3', { tar: 40 }),
                ]}
            />
        );
        await screen.findByRole('table');
        const nums = [...document.querySelectorAll('tbody tr')].map(
            (r) => r.querySelector('td:nth-child(2)')?.textContent?.match(/\d+/)?.[0]
        );
        expect(nums).toEqual(['2', '3', '1']);
    });

    it('orders columns TAR first and Last Seen last', async () => {
        await renderWithRouter(
            <LeaderboardTable group="red" season="2026" ranked={[carStats('1')]} />
        );
        await screen.findByRole('table');
        const heads = [...document.querySelectorAll('thead th')].map((h) => h.textContent);

        expect(heads.slice(4, 8).map((h) => h?.replace(/\s/g, ''))).toEqual([
            'TAR',
            'TimeSaved',
            'DaysinService',
            'IronHorseStreak',
        ]);
        expect(heads.at(-1)).toContain('Last Seen');
    });

    it('shows the small-board note, and no close-race text, on a route board with few ranked buses', async () => {
        await renderWithRouter(
            <LeaderboardTable
                group="bus"
                season="2026"
                ranked={five.slice(0, 3)}
                cols={routeBoardStats()}
                scope="route"
            />
        );
        expect(
            await screen.findByText('Only 3 ranked buses on this route, so percentiles are rough.')
        ).toBeTruthy();
        expect(screen.queryByText(/Close race/)).toBeNull();
    });
});
