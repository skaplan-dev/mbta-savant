import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { car } from '../../test/fixtures';
import { renderWithRouter } from '../../test/router';
import BioPanel from './BioPanel';

afterEach(cleanup);

const panel = (o: Parameters<typeof car>[1] = {}) => (
    <BioPanel group="red" number="1902" season="2026" car={car('1902', o)} files={[]} />
);

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
});
