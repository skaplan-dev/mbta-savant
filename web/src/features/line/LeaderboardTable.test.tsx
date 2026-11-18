import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { carStats } from '../../test/fixtures';
import { renderWithRouter } from '../../test/router';
import LeaderboardTable from './LeaderboardTable';

afterEach(cleanup);

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
});
