import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Search from './Search';

const navigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }));
vi.mock('../queries', () => {
    const e = (group: string, number: string, fleet_label: string) => ({
        car_id: `${group}:${number}`,
        group,
        number,
        fleet_label,
    });
    return {
        useMeta: () => ({ data: { windows: [{ key: '2026' }] } }),
        defaultWindow: () => '2026',
        useIndex: () => ({
            data: [
                e('bus', '1400', 'Bus fleet'),
                e('orange', '1400', 'Orange #14'),
                e('red', '1500', 'Red #1'),
            ],
        }),
    };
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
        });
    });
});
