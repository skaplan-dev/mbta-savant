import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mergeIndexes, type SearchEntry } from '../carSearch';
import { indexEntry } from '../test/fixtures';
import SearchBox from './SearchBox';

const entries = mergeIndexes(
    ['2026', '2025'],
    new Map([
        [
            '2026',
            [
                indexEntry('1400', { group: 'bus', fleet_label: 'Bus fleet' }),
                indexEntry('1400', { group: 'orange', fleet_label: 'Orange #14' }),
                indexEntry('1500', { fleet_label: 'Red #1' }),
            ],
        ],
        [
            '2025',
            [
                indexEntry('1500', { fleet_label: 'Red #1 (old)' }),
                indexEntry('1510', { fleet_label: 'Red 2025-only' }),
            ],
        ],
    ])
);

function setup() {
    const onPick = vi.fn<(e: SearchEntry) => void>();
    const onWant = vi.fn<() => void>();
    render(
        <SearchBox
            label="Search"
            entries={entries}
            loading={false}
            onWant={onWant}
            onPick={onPick}
        />
    );

    return { input: screen.getByRole('combobox'), onPick, onWant };
}

afterEach(cleanup);

describe('SearchBox', () => {
    it('lists matches across groups and Enter opens the first', () => {
        const { input, onPick } = setup();
        fireEvent.change(input, { target: { value: '1400' } });
        const opts = screen.getAllByRole('option');
        expect(opts).toHaveLength(2);
        expect(opts[0].textContent).toContain('Orange #14');
        expect(opts[1].textContent).toContain('Bus fleet');
        fireEvent.submit(input);
        expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ car_id: 'orange:1400' }));
    });

    it('finds cars that only have data in an older window', () => {
        const { input, onPick } = setup();
        fireEvent.change(input, { target: { value: '1510' } });
        expect(screen.getAllByRole('option')).toHaveLength(1);
        fireEvent.submit(input);
        expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ window: '2025' }));
    });

    it('asks for data on focus, and only sets aria-controls while the list shows', () => {
        const { input, onWant } = setup();
        expect(onWant).not.toHaveBeenCalled();
        expect(input.hasAttribute('aria-controls')).toBe(false);
        fireEvent.focus(input);
        expect(onWant).toHaveBeenCalled();
        fireEvent.change(input, { target: { value: '15' } });
        expect(input.getAttribute('aria-controls')).toBe(screen.getByRole('listbox').id);
    });
});
