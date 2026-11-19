import { routeLabel } from './busRoutes';
import { GROUPS, type GroupId } from './groups';
import { seasonLabel } from './seasons';

const SITE = 'MBTA Savant';

export const HOME_TITLE = `${SITE} — every car, every trip`;
export const GLOSSARY_TITLE = `Stat Glossary · ${SITE}`;
export const NOT_FOUND_TITLE = `Not found · ${SITE}`;

export function carTitle(group: GroupId, number: string) {
    const { noun, mode, name } = GROUPS[group];

    // "Bus 1400 · Bus" would repeat itself, so buses skip the line name.
    return mode === 'rail'
        ? `${noun} ${number} · ${name} · ${SITE}`
        : `${noun} ${number} · ${SITE}`;
}

export const lineTitle = (season: string, group: GroupId) =>
    `${seasonLabel(season)} ${GROUPS[group].name} Leaderboard · ${SITE}`;

export const routeTitle = (season: string, route: string) =>
    `${seasonLabel(season)} Route ${routeLabel(route)} Leaderboard · ${SITE}`;
