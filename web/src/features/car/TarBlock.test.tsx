import { cleanup, fireEvent, screen } from '@testing-library/react';
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
    it('keeps the math closed until asked, then shows the inputs', async () => {
        const { container } = await renderWithRouter(
            <TarBlock car={tarCar()} summary={summary()} />
        );
        const d = container.querySelector('details');

        if (!d) throw new Error('no details');

        expect(d.open).toBe(false);
        fireEvent.click(screen.getByText('Show the math'));
        expect(d.open).toBe(true);

        const field = screen.getByText(/On the field:/).parentElement?.textContent ?? '';

        expect(field).toContain('100 eligible days');
        expect(field).toContain('+1,400');
        expect(screen.getByText(/parts may differ by a trip/)).toBeTruthy();
        expect(screen.getByRole('link', { name: 'How TAR is calculated' })).toBeTruthy();
    });
    it('shows a dash and no math for legacy data', async () => {
        const legacy = summary({ trip_len_sec: undefined, tar_replacement: undefined });

        await renderWithRouter(<TarBlock car={tarCar()} summary={legacy} />);
        expect(screen.queryByText('Show the math')).toBeNull();

        cleanup();
        await renderWithRouter(
            <TarBlock car={car('1902', { tar: undefined })} summary={summary()} />
        );
        expect(screen.getByText('–')).toBeTruthy();
        expect(screen.queryByText('Show the math')).toBeNull();
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
        expect(screen.queryByText('Show the math')).toBeNull();
        expect(screen.getByText(/Not enough trips/)).toBeTruthy();
    });
    it('lets a reader recompute the field part from the rendered numbers', async () => {
        await renderWithRouter(<TarBlock car={tarCar()} summary={summary()} />);
        fireEvent.click(screen.getByText('Show the math'));

        const t = screen.getByText(/On the field:/).parentElement?.textContent ?? '';
        const num = (re: RegExp) => Number((re.exec(t)?.[1] ?? 'NaN').replace(/,/g, ''));
        const share = num(/eligible days = ([\d.]+)/);
        const repl = num(/− replacement ([\d.]+)\)/);
        const days = num(/\) × ([\d,]+) eligible days/);
        const tpd = num(/× ([\d.]+) trips per day/);
        const shown = num(/= \+?([\d,]+)$/);

        expect(share).toBe(0.9);
        expect(Math.abs((share - repl) * days * tpd - shown)).toBeLessThanOrEqual(1);

        const sp = screen.getByText(/Speed:/).parentElement?.textContent ?? '';
        const n2 = (str: string, re: RegExp) =>
            Number((re.exec(str)?.[1] ?? 'NaN').replace(/,/g, '').replace('−', '-'));

        expect(sp).toContain('(+15.0 seconds saved per trip − replacement +5.0)');
        expect(sp).not.toContain('s seconds');

        const fast = n2(sp, /\(([+−][\d.]+) seconds/);
        const rf = n2(sp, /replacement ([+−][\d.]+)\)/);
        const trips = n2(sp, /× ([\d,]+) trips/);
        const len = n2(sp, /÷ ([\d,]+) s/);
        const speedShown = n2(sp, /= ([+−]?[\d,]+)$/);

        expect(Math.abs(((fast - rf) * trips) / len - speedShown)).toBeLessThanOrEqual(1);

        const st =
            screen.getByText(/Steadiness:/, { selector: 'b' }).parentElement?.textContent ?? '';
        const sv = n2(st, /\(([+−][\d.]+) s/);
        const rs = n2(st, /replacement ([+−][\d.]+) s\)/);
        const segs = n2(st, /× ([\d.]+) segments/);
        const stTrips = n2(st, /× ([\d,]+) trips/);
        const stLen = n2(st, /÷ ([\d,]+) s/);
        const stShown = n2(st, /= ([+−]?[\d,]+)$/);

        expect(Math.abs(((sv - rs) * segs * stTrips) / stLen - stShown)).toBeLessThanOrEqual(1);
    });
    it('uses explicit operators and a real minus for negative parts', async () => {
        await renderWithRouter(
            <TarBlock
                car={tarCar({ tar: -447, tar_parts: { field: -451, speed: 12, steady: -8 } })}
                summary={summary()}
            />
        );
        fireEvent.click(screen.getByText('Show the math'));

        expect(screen.getByText(/Total:/).parentElement?.textContent).toContain(
            '−451 + 12 − 8 = −447 trips'
        );
        expect(screen.getByText('On the field −451')).toBeTruthy();
    });
    it('never prints a minus before a zero part', async () => {
        await renderWithRouter(
            <TarBlock
                car={tarCar({ tar: 1400, tar_parts: { field: 1400, speed: -0.2, steady: 0 } })}
                summary={summary()}
            />
        );
        fireEvent.click(screen.getByText('Show the math'));

        expect(screen.getByText(/Total:/).parentElement?.textContent).not.toContain('− 0');
    });
    it('counts an unmeasured steadiness as 0 in the total', async () => {
        await renderWithRouter(
            <TarBlock car={tarCar({ steady_adj_sec: null })} summary={summary()} />
        );
        fireEvent.click(screen.getByText('Show the math'));

        expect(screen.getByText(/Total:/).parentElement?.textContent).toContain(
            '+1,400 + 8 + 0 (not measured) = +1,414 trips'
        );
    });
    it('does not crash or show math when tar_parts is missing', async () => {
        await renderWithRouter(
            <TarBlock car={tarCar({ tar_parts: undefined })} summary={summary()} />
        );

        expect(screen.getByText('+1,414 trips above replacement')).toBeTruthy();
        expect(screen.queryByText('Show the math')).toBeNull();
    });
});
