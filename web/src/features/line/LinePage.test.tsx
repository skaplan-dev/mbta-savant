import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CarStats } from '../../api';
import { Table } from './LinePage';

vi.mock('@tanstack/react-router', () => ({
    Link: ({ children }: { children?: ReactNode }) => <a href="/x">{children}</a>,
}));

const car = (number: string, saved: number) =>
    ({
        car_id: `red:${number}`,
        number,
        trips: 100,
        qualified: true,
        ranked: true,
        ttoe_vs_avg_sec: saved,
        pct: {},
        vehicle: { fleet_key: 'k', fleet_label: 'Fleet' },
    }) as unknown as CarStats;

afterEach(cleanup);

describe('leaderboard Table', () => {
    it('keeps keyboard focus on a sort button after activating it', () => {
        render(<Table group="red" season="2026" ranked={[car('1', 1), car('2', -2)]} />);
        const btn = screen.getByRole('button', { name: 'Sort by trips' });
        btn.focus();
        expect(document.activeElement).toBe(btn);
        fireEvent.click(btn);
        expect(screen.getByRole('button', { name: 'Sort by trips' })).toBe(btn);
        expect(document.activeElement).toBe(btn);
    });
});
