import { describe, expect, it } from 'vitest';
import { commonsUrl, fleetPhoto, photoSrc } from './fleetPhotos';

const rosters = import.meta.glob<{ series: { fleet_key: string }[] }>(
    '../../pipeline/savant/data/roster.json',
    { eager: true, import: 'default' }
);
const roster = Object.values(rosters)[0];

describe('fleetPhoto', () => {
    it('finds the roster', () => expect(roster.series.length).toBeGreaterThan(0));

    it('has a photo on disk for every fleet in the roster', () => {
        for (const key of new Set(roster.series.map((s) => s.fleet_key))) {
            const p = fleetPhoto(key);

            expect(p, key).not.toBeNull();
            expect(p && photoSrc(p), key).toBeTruthy();
        }
    });

    it('returns null for unknown fleets', () => {
        expect(fleetPhoto(undefined)).toBeNull();
        expect(fleetPhoto('unknown')).toBeNull();
    });

    it('links to the Commons file page', () => {
        expect(commonsUrl(fleetPhoto('bus-de60lfr-2010')!)).toBe(
            'https://commons.wikimedia.org/wiki/File:MBTA_New_Flyer_DE60LFR_1223_at_Copley_Square.jpg'
        );
    });
});
