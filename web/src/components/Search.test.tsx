import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Search from './Search';

const navigate = vi.fn();
const useAllIndexes = vi.fn();
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }));
vi.mock('../queries', () => ({
    defaultWindow: () => '2026',
    useAllIndexes: (enabled: boolean) => useAllIndexes(enabled),
}));

const e = (group: string, number: string, fleet_label: string) => ({
    car_id: `${group}:${number}`,
    group,
    number,
    fleet_label,
});

afterEach(cleanup);
beforeEach(() => {
    navigate.mockClear();
    useAllIndexes.mockReset();
    useAllIndexes.mockImplementation(() => ({
        meta: { windows: [{ key: '2026' }, { key: '2025' }] },
        windows: ['2026', '2025'],
        indexes: {
            '2026': [
                e('bus', '1400', 'Bus fleet'),
                e('orange', '1400', 'Orange #14'),
                e('red', '1500', 'Red #1'),
            ],
            '2025': [e('red', '1500', 'Red #1 (old)'), e('red', '1510', 'Red 2025-only')],
        },
        loading: false,
    }));
});

describe('Search', () => {
    it('lists matches across groups and Enter opens the first', () => {
        render(<Search />);
        const input = screen.getByRole('combobox');
        fireEvent.change(input, { target: { value: '1400' } });
        const opts = screen.getAllByRole('option');
        expect(opts).toHaveLength(2);
        expect(opts[0].textContent).toContain('Orange #14');
        expect(opts[1].textContent).toContain('Bus fleet');
        fireEvent.submit(input.closest('form')!);
        expect(navigate).toHaveBeenCalledWith({
            to: '/car/$group/$number',
            params: { group: 'orange', number: '1400' },
            search: {},
        });
    });

    it('finds cars that only have data in an older window and links to that season', () => {
        render(<Search />);
        const input = screen.getByRole('combobox');
        fireEvent.change(input, { target: { value: '1510' } });
        expect(screen.getAllByRole('option')).toHaveLength(1);
        fireEvent.submit(input.closest('form')!);
        expect(navigate).toHaveBeenCalledWith({
            to: '/car/$group/$number',
            params: { group: 'red', number: '1510' },
            search: { season: 2025 },
        });
    });

    it('does not load indexes until focus, and only sets aria-controls while the list shows', () => {
        render(<Search />);
        const input = screen.getByRole('combobox');
        expect(useAllIndexes).toHaveBeenLastCalledWith(false);
        expect(input.hasAttribute('aria-controls')).toBe(false);
        fireEvent.focus(input);
        expect(useAllIndexes).toHaveBeenLastCalledWith(true);
        fireEvent.change(input, { target: { value: '15' } });
        expect(input.getAttribute('aria-controls')).toBe(screen.getByRole('listbox').id);
    });
});
