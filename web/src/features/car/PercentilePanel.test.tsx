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
    segs_per_trip: 16,
    typical: {},
    too_close: [],
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
            screen.getByText(/Time Saved and Dwell Time compare a car with its line’s typical car/)
        ).toBeTruthy();
    });
    it('has no close-race note, even when the pipeline lists too-close stats', async () => {
        await renderWithRouter(
            <PercentilePanel
                group="red"
                season="2026"
                car={car('1902')}
                summary={summary('red', {
                    too_close: ['on_time_pct'],
                    spread: { on_time_pct: 0.6 },
                })}
            />
        );

        expect(screen.queryByText(/Close race/)).toBeNull();
        expect(screen.queryByText(/Small differences move/)).toBeNull();
    });
    it('has Performance then Availability sections', async () => {
        await renderWithRouter(
            <PercentilePanel group="red" season="2026" car={car('1902')} summary={summary('red')} />
        );

        const names = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);

        expect(names).toEqual(['Performance', 'Availability']);
    });
    it('renders with a summary from before the per-trip stats existed', async () => {
        const { typical: _t, too_close: _c, segs_per_trip: _s, ...old } = summary('red');

        await renderWithRouter(
            <PercentilePanel group="red" season="2026" car={car('1902')} summary={old} />
        );

        expect(title()).toBe('2026 Red Line Percentile Rankings');
    });
});
