import { GROUPS, seasonLabel, type GroupId } from './format';

const SITE = 'MBTA Savant';

export const HOME_TITLE = `${SITE} — every car, every trip`;
export const GLOSSARY_TITLE = `Stat Glossary · ${SITE}`;
export const NOT_FOUND_TITLE = `Not found · ${SITE}`;

export const carTitle = (group: GroupId, number: string) =>
    group === 'bus' ? `Bus ${number} · ${SITE}` : `Car ${number} · ${GROUPS[group].name} · ${SITE}`;

export const lineTitle = (season: string, group: GroupId) =>
    `${seasonLabel(season)} ${GROUPS[group].name} Leaderboard · ${SITE}`;
