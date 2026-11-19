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
    it('keeps keyboard focus on a sort button after activating it', async () => {
        await renderWithRouter(
            <LeaderboardTable
                group="red"
                season="2026"
                ranked={[
                    carStats('1', { trip_vs_typical_sec: 1 }),
                    carStats('2', { trip_vs_typical_sec: -2 }),
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

    it('explains too-close columns above the table', async () => {
        await renderWithRouter(
            <LeaderboardTable
                group="red"
                season="2026"
                ranked={five}
                tooClose={['on_time_pct', 'dwell_time_sec']}
            />
        );
        expect(
            await screen.findByText(
                'Too close to call on this line: Dwell Time, On-Schedule %. Shown without colors.'
            )
        ).toBeTruthy();
    });

    it('shows no banner when nothing is too close', async () => {
        await renderWithRouter(
            <LeaderboardTable group="red" season="2026" ranked={[carStats('1')]} tooClose={[]} />
        );
        await screen.findByRole('table');
        expect(screen.queryByText(/Too close to call/)).toBeNull();
    });

    it('orders columns Time Saved first and Last Seen last', async () => {
        await renderWithRouter(
            <LeaderboardTable group="red" season="2026" ranked={[carStats('1')]} tooClose={[]} />
        );
        await screen.findByRole('table');
        const heads = [...document.querySelectorAll('thead th')].map((h) => h.textContent);

        expect(heads.slice(4, 8).map((h) => h?.replace(/\s/g, ''))).toEqual([
            'TimeSaved',
            'DaysinService',
            'IronHorseStreak',
            'TravelTime',
        ]);
        expect(heads.at(-1)).toContain('Last Seen');
    });

    it('names only real columns in the too-close banner', async () => {
        await renderWithRouter(
            <LeaderboardTable
                group="bus"
                season="2026"
                ranked={five}
                cols={routeBoardStats()}
                tooClose={['routes', 'on_time_pct']}
            />
        );
        expect(
            await screen.findByText(
                'Too close to call on this line: On-Schedule %. Shown without colors.'
            )
        ).toBeTruthy();
    });

    it('says "on this route" on a route board with enough ranked buses', async () => {
        await renderWithRouter(
            <LeaderboardTable
                group="bus"
                season="2026"
                ranked={five}
                cols={routeBoardStats()}
                tooClose={['on_time_pct']}
                scope="route"
            />
        );
        expect(
            await screen.findByText(
                'Too close to call on this route: On-Schedule %. Shown without colors.'
            )
        ).toBeTruthy();
    });

    it('does not claim a tie when a route board has too few ranked buses', async () => {
        await renderWithRouter(
            <LeaderboardTable
                group="bus"
                season="2026"
                ranked={five.slice(0, 3)}
                cols={routeBoardStats()}
                tooClose={['on_time_pct', 'trip_time_sec']}
                scope="route"
            />
        );
        expect(
            await screen.findByText(
                'Too few ranked buses on this route for percentiles; values are shown without colors.'
            )
        ).toBeTruthy();
        expect(screen.queryByText(/Too close to call/)).toBeNull();
    });
});
