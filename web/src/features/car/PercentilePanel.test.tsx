import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { GroupSummary } from '../../api';
import { car } from '../../test/fixtures';
import { renderWithRouter } from '../../test/router';
import PercentilePanel from './PercentilePanel';

afterEach(cleanup);

const summary = (group: GroupSummary['group'], o: Partial<GroupSummary> = {}): GroupSummary => ({
    group,
    window: '2026',
    generated_at: '',
    qualify_min_trips: 870,
    ranked_cars: 216,
    averages: { ttoe_sec: 0, speed_vs_expected_pct: 0 },
    ...o,
});

const title = () => screen.getByRole('heading', { level: 2 }).textContent;

describe('PercentilePanel', () => {
    it("calls a ranked car's panel percentile rankings, and says what it was ranked against", async () => {
        await renderWithRouter(
            <PercentilePanel group="red" season="2026" car={car('1902')} summary={summary('red')} />
        );

        expect(title()).toBe('2026 Red Line Percentile Rankings');
        expect(screen.getByText('Ranked against 216 qualified Red Line cars.')).toBeTruthy();
    });
    it('does not promise rankings for a car that is not ranked, and says why before the numbers', async () => {
        await renderWithRouter(
            <PercentilePanel
                group="red"
                season="2026"
                car={car('1950', { qualified: false })}
                summary={summary('red')}
            />
        );

        expect(title()).toBe('2026 Red Line Stats');

        const why = screen.getByText(/Not enough trips/);
        const firstGroup = screen.getByRole('heading', { name: 'Performance' });

        expect(
            why.compareDocumentPosition(firstGroup) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
        expect(screen.queryByText(/Ranked against/)).toBeNull();
    });
    it('explains the dashes on a line that is never ranked', async () => {
        await renderWithRouter(
            <PercentilePanel
                group="mattapan"
                season="last30"
                car={car('3234', { ranked: false })}
                summary={summary('mattapan', { ranked_cars: 0 })}
            />
        );

        expect(title()).toBe('Last 30 Days Mattapan Line Stats');
        expect(screen.getByText(/Mattapan cars aren’t ranked\./)).toBeTruthy();
        expect(
            screen.getByText(/Time Saved, Pace and Door Time compare a car with its line’s average/)
        ).toBeTruthy();
    });
});
