import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Car, GroupSummary } from '../../api';
import { car, carStats } from '../../test/fixtures';
import { renderWithRouter } from '../../test/router';
import PercentilePanel from './PercentilePanel';
import TarBlock from './TarBlock';

afterEach(cleanup);

const summary = (o: Partial<GroupSummary> = {}): GroupSummary => ({
    group: 'red',
    window: '2026',
    generated_at: '',
    qualify_min_trips: 870,
    ranked_cars: 216,
    segs_per_trip: 16,
    typical: {},
    too_close: [],
    trip_len_sec: 2400,
    trips_per_day: 20,
    tar_replacement: { service_share: 0.2, fast_sec: 5, steady_adj_sec: 1 },
    ...o,
});

const tarCar = (o: Parameters<typeof carStats>[1] = {}): Car => ({
    ...carStats('1902', {
        tar: 1414,
        tar_parts: { field: 1400, speed: 8, steady: 6 },
        eligible_days: 100,
        service_days: 90,
        steady_adj_sec: 1.5,
        trips: 1800,
        travel_vs_typical_sec: -12,
        dwell_vs_typical_sec: -3,
        pct: { tar: 80 },
        ...o,
    }),
    game_log: [],
});

describe('TarBlock', () => {
    it('leads with the TAR value and the three parts', async () => {
        await renderWithRouter(<TarBlock car={tarCar()} summary={summary()} />);

        expect(screen.getByText('+1,414 trips above replacement')).toBeTruthy();
        expect(screen.getByText('On the field +1,400')).toBeTruthy();
        expect(screen.getByText('Speed +8')).toBeTruthy();
        expect(screen.getByText('Steadiness +6')).toBeTruthy();
        expect(screen.getByRole('img', { name: /TAR: 80th percentile/ })).toBeTruthy();
    });
    it('says steadiness is not measured when its input is null', async () => {
        await renderWithRouter(
            <TarBlock car={tarCar({ steady_adj_sec: null })} summary={summary()} />
        );

        expect(screen.getByText('Steadiness not measured')).toBeTruthy();
    });
    it('has no "Show the math" section and no calculation link', async () => {
        const { container } = await renderWithRouter(
            <TarBlock car={tarCar()} summary={summary()} />
        );

        expect(screen.queryByText('Show the math')).toBeNull();
        expect(container.querySelector('details')).toBeNull();
        expect(screen.queryByRole('link', { name: 'How TAR is calculated' })).toBeNull();
    });
    it('shows a dash for legacy data', async () => {
        await renderWithRouter(
            <TarBlock car={car('1902', { tar: undefined })} summary={summary()} />
        );
        expect(screen.getByText('–')).toBeTruthy();
    });
    it('is absent from the panel of an unranked car', async () => {
        await renderWithRouter(
            <PercentilePanel
                group="red"
                season="2026"
                car={tarCar({ qualified: false })}
                summary={summary()}
            />
        );

        expect(screen.queryByText('TAR')).toBeNull();
        expect(screen.getByText(/Not enough trips/)).toBeTruthy();
    });
    it('does not crash when tar_parts is missing', async () => {
        await renderWithRouter(
            <TarBlock car={tarCar({ tar_parts: undefined })} summary={summary()} />
        );

        expect(screen.getByText('+1,414 trips above replacement')).toBeTruthy();
    });
    it('says "below" with the absolute value for a negative TAR, and "at replacement" for 0', async () => {
        await renderWithRouter(
            <TarBlock
                car={tarCar({ tar: -451, tar_parts: { field: -451, speed: 0, steady: 0 } })}
                summary={summary()}
            />
        );
        expect(screen.getByText('451 trips below replacement')).toBeTruthy();

        cleanup();
        await renderWithRouter(
            <TarBlock
                car={tarCar({ tar: 0, tar_parts: { field: 0, speed: 0, steady: 0 } })}
                summary={summary()}
            />
        );
        expect(screen.getByText('at replacement level')).toBeTruthy();
    });
    it('says steadiness is not measured when the replacement level is missing', async () => {
        const noRepl = summary({
            tar_replacement: { service_share: 0.2, fast_sec: 5, steady_adj_sec: null },
        });

        await renderWithRouter(<TarBlock car={tarCar()} summary={noRepl} />);

        expect(screen.getByText('Steadiness not measured')).toBeTruthy();
    });
});
