import { notFound } from '@tanstack/react-router';
import type { StatId } from './glossary';

export const GROUP_IDS = ['red', 'orange', 'blue', 'green', 'mattapan', 'bus'] as const;

export type GroupId = (typeof GROUP_IDS)[number];

export type Mode = 'rail' | 'bus';

export type ArtKind = 'heavy-rail' | 'light-rail' | 'pcc' | 'bus';

interface ModeInfo {
    noun: 'Car' | 'Bus';
    /** Rail logs miles; bus stop-to-stop distances aren't in the data yet. */
    showMiles: boolean;
    /** The "who/where it runs with" table: coupled cars for rail, routes for buses. */
    partner: { stat: StatId; tab: string; link: string };
    /** Game log column listing what the vehicle ran on each day. */
    placesLabel: string;
}

const MODES: Record<Mode, ModeInfo> = {
    rail: {
        noun: 'Car',
        showMiles: true,
        partner: { stat: 'coupled-with', tab: 'COUPLED WITH', link: 'Coupled With' },
        placesLabel: 'Lines',
    },
    bus: {
        noun: 'Bus',
        showMiles: false,
        partner: { stat: 'routes-run', tab: 'ROUTES', link: 'Routes Run' },
        placesLabel: 'Routes',
    },
};

export interface GroupInfo extends ModeInfo {
    name: string;
    short: string;
    color: string;
    /** Text class that reads on `color`. */
    onColor: 'text-white' | 'text-ink';
    mode: Mode;
    /** Mattapan's handful of trolleys get stats but no percentiles. */
    ranked: boolean;
    /** Who a ranked car is compared with, e.g. "Red Line cars". */
    pool: string;
    art: ArtKind;
}

function rail(name: string, short: string, color: string, art: ArtKind, ranked = true): GroupInfo {
    return {
        ...MODES.rail,
        name,
        short,
        color,
        onColor: 'text-white',
        mode: 'rail',
        ranked,
        pool: `${name} cars`,
        art,
    };
}

export const GROUPS: Record<GroupId, GroupInfo> = {
    red: rail('Red Line', 'Red', '#da291c', 'heavy-rail'),
    // Dark text: white on this orange is only 2.5:1.
    orange: { ...rail('Orange Line', 'Orange', '#ed8b00', 'heavy-rail'), onColor: 'text-ink' },
    blue: rail('Blue Line', 'Blue', '#003da5', 'heavy-rail'),
    green: rail('Green Line', 'Green', '#00843d', 'light-rail'),
    mattapan: rail('Mattapan Line', 'Mattapan', '#66767a', 'pcc', false),
    bus: {
        ...MODES.bus,
        name: 'Bus',
        short: 'Bus',
        color: '#ffc72c',
        onColor: 'text-ink',
        mode: 'bus',
        ranked: true,
        pool: 'buses',
        art: 'bus',
    },
};

export const isGroup = (g: string): g is GroupId => Object.hasOwn(GROUPS, g);

/** Route param parser: an unknown group is a 404, so pages always get a GroupId. */
export function parseGroup(g: string): GroupId {
    if (!isGroup(g)) throw notFound();

    return g;
}
