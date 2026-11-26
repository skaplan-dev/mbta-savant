import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { CareerCar } from '../../api';
import { car, careerCar, seasonRow } from '../../test/fixtures';
import { renderWithRouter } from '../../test/router';
import BioPanel from './BioPanel';

afterEach(cleanup);

const panel = (o: Parameters<typeof careerCar>[1] = {}, season = '2026') => {
    const career: CareerCar = careerCar('1902', o);

    return (
        <BioPanel
            group="red"
            number="1902"
            season={season}
            career={career}
            car={season === 'career' ? career : car('1902')}
        />
    );
};

describe('BioPanel', () => {
    it('shows when a new delivery entered service', async () => {
        await renderWithRouter(
            panel({ new_delivery: true, first_seen: '2026-03-02', last_seen: '2026-05-01' })
        );

        expect(screen.getByText(/In service since: .*2026/)).toBeTruthy();
        expect(screen.getByText(/Last seen:/)).toBeTruthy();
    });
    it('omits it for an older car', async () => {
        await renderWithRouter(
            panel({ new_delivery: false, first_seen: '2025-01-02', last_seen: '2026-05-01' })
        );

        expect(screen.queryByText(/In service since/)).toBeNull();
    });
    it('says when the fleet was retired', async () => {
        await renderWithRouter(
            panel({
                vehicle: { fleet_key: 'k', fleet_label: 'F', years: '1979', retired: '2022' },
            })
        );

        expect(screen.getByText('Retired 2022')).toBeTruthy();
    });
    it('has no retired note for a car still running', async () => {
        await renderWithRouter(panel());

        expect(screen.queryByText(/Retired/)).toBeNull();
    });
});

describe('SeasonTable', () => {
    const seasons = [
        seasonRow('2026', { trips: 953, pct_tar: 69 }),
        seasonRow('2025', { trips: 1622, travel_vs_typical_sec: 12.7 }),
    ];

    it('has a row per season from the career file, plus All-time', async () => {
        await renderWithRouter(
            panel({ seasons, trips: 2575, travel_vs_typical_pct: -0.44, tar: 1555 })
        );
        const table = screen.getByRole('table', { name: 'Seasons' });
        const rows = within(table).getAllByRole('row');

        // Header, two seasons, All-time.
        expect(rows).toHaveLength(4);
        // The test router JSON-encodes search values; the app's own serializer writes them bare.
        expect(within(table).getByRole('link', { name: '2026' }).getAttribute('href')).toMatch(
            /season=.*2026/
        );
        expect(within(table).getByText('1,622')).toBeTruthy();
        expect(within(table).getByText('−13 s')).toBeTruthy();

        const total = rows[3];

        if (!total) throw new Error('no All-time row');
        expect(within(total).getByRole('link', { name: 'All-time' }).getAttribute('href')).toMatch(
            /season=.*career/
        );
        expect(within(total).getByText('2,575')).toBeTruthy();
        expect(within(total).getByText('+0.4%')).toBeTruthy();
        expect(within(total).getByText('+1,555')).toBeTruthy();
    });

    it('tints the TAR cell by its percentile', async () => {
        await renderWithRouter(panel({ seasons }));
        const [cell] = screen.getAllByText('+100', { selector: 'td' });

        expect(cell?.style.background).toContain('color-mix');
    });
});
