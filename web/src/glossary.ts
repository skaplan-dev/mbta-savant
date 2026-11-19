// Single source for stat definitions: used by the stat popovers and the Glossary page.

export type StatId =
    | 'time-saved'
    | 'dwell-time'
    | 'on-schedule'
    | 'consistency'
    | 'days-in-service'
    | 'iron-horse'
    | 'miles'
    | 'crowding'
    | 'coupled-with'
    | 'routes-run'
    | 'last-seen';

export interface GlossaryEntry {
    name: string;
    section: 'performance' | 'availability' | 'fun';
    short: string;
    lead: string;
    better: 'higher' | 'lower' | 'none';
    /** Label shown beside the name on the Glossary page. */
    betterLabel: string;
    calc: string;
    example?: string;
}

export const GLOSSARY: Record<StatId, GlossaryEntry> = {
    'time-saved': {
        name: 'Time Saved',
        section: 'performance',
        short: 'Seconds of travel time this car saves on a typical trip, compared with the line’s typical car on the same segments at the same times.',
        lead: 'Seconds of travel time this car saves per trip, compared with the line’s typical car (the median ranked car).',
        better: 'higher',
        betterLabel: 'HIGHER IS BETTER',
        calc: 'Travel time runs from leaving one stop to arriving at the next. For every segment the car runs, we compare its travel time with the median for that segment, direction, hour and day type, counting any delay past five minutes as five minutes. We total those differences over a typical trip and show the result relative to the line’s typical car (the median ranked car). Time at stops is not included; that’s Dwell Time, which is kept separate because it depends on crowds and operators and on how each car’s arrivals and departures are recorded. The percentage is the same difference as a share of the trip’s expected travel time.',
        example:
            '+32 s · +1.8% means about 32 seconds less travel time per trip than the typical car, 1.8% of the trip',
    },
    'dwell-time': {
        name: 'Dwell Time',
        section: 'performance',
        short: 'Seconds of dwell time this car saves per trip compared with the line’s typical car at the same stops and times. Separate from Time Saved.',
        lead: 'Seconds of dwell time this car saves per trip, compared with the line’s typical car at the same stops and times.',
        better: 'higher',
        betterLabel: 'HIGHER IS BETTER',
        calc: 'Dwell time runs from arriving at a stop to leaving it. At each stop, we compare the car’s dwell with the median dwell there for the same direction, hour and day type, counting differences beyond 30 seconds either way as 30. We total those differences over a typical trip and show the result relative to the line’s typical car (the median ranked car). Dwell depends on crowds and operators as much as on the car, so take it with a grain of salt.',
        example: '+12 s means about 12 seconds less dwell per trip than the typical car',
    },
    'on-schedule': {
        name: 'On-Schedule %',
        section: 'performance',
        short: 'Share of segments where this car’s travel time between stops was at or under the MBTA’s scheduled travel time.',
        lead: 'Share of segments where this car’s travel time between stops was at or under the MBTA’s scheduled travel time.',
        better: 'higher',
        betterLabel: 'HIGHER IS BETTER',
        calc: 'Each segment is checked against the T’s scheduled travel time for it; whole trips aren’t scored. Scheduled times are published in whole minutes, so most short segments count as on schedule. The spread between cars is small but real.',
    },
    consistency: {
        name: 'Consistency',
        section: 'performance',
        short: 'How much this car’s travel times between stops vary from its own norm, in seconds. Smaller means more predictable trips.',
        lead: 'How much this car’s travel times between stops vary from its own norm, in seconds.',
        better: 'lower',
        betterLabel: 'SMALLER SPREAD IS BETTER',
        calc: 'Each segment’s travel time is first compared with the median for that segment, direction, hour and day type. We then average how far each of those differences sits from the car’s own typical difference, counting anything past a minute as a minute. A car that is always a little slow scores well here; only variation counts.',
    },
    'days-in-service': {
        name: 'Days in Service',
        section: 'availability',
        short: 'Share of this season’s service days on which this car ran at least one trip.',
        lead: 'Share of this season’s service days on which this car ran at least one trip.',
        better: 'higher',
        betterLabel: 'HIGHER IS BETTER',
        calc: 'Only days when the line ran and reported data count, so a data outage doesn’t hurt anyone. A low number usually means time in the shop, or a car held as a spare.',
    },
    'iron-horse': {
        name: 'Iron Horse Streak',
        section: 'availability',
        short: 'Most consecutive service days this car ran this season.',
        lead: 'Most consecutive service days this car ran this season.',
        better: 'higher',
        betterLabel: 'HIGHER IS BETTER',
        calc: 'Days when the whole line reported no data are skipped, so an outage doesn’t break a streak. Named for the baseball nickname for players who never miss a game.',
    },
    miles: {
        name: 'Miles Logged',
        section: 'availability',
        short: 'Revenue miles this season: distance run in passenger service.',
        lead: 'Revenue miles this season: distance run in passenger service.',
        better: 'higher',
        betterLabel: 'HIGHER IS BETTER',
        calc: 'The stop-to-stop distances of every segment the car ran, added up. Deadhead moves to and from the yard aren’t counted. Rail only for now.',
    },
    crowding: {
        name: 'Avg Crowding',
        section: 'fun',
        short: 'Average load as a share of capacity, from on-board passenger counters. Only newer cars report it.',
        lead: 'Average load as a share of capacity, from on-board passenger counters.',
        better: 'none',
        betterLabel: 'NOT RANKED',
        calc: 'Only newer cars (such as the Red and Orange Line CRRC cars) report it, so it would be unfair to rank.',
    },
    'coupled-with': {
        name: 'Coupled With',
        section: 'fun',
        short: 'The cars this car most often runs coupled to in the same consist, and how many trips they shared.',
        lead: 'The cars this car most often runs coupled to in the same consist, and how many trips they shared.',
        better: 'none',
        betterLabel: 'NOT RANKED',
        calc: 'Shown as a share of this car’s trips, so a married partner is always at 100%.',
    },
    'routes-run': {
        name: 'Routes Run',
        section: 'availability',
        short: 'How many different routes a bus ran this season. The utility players of the fleet.',
        lead: 'How many different routes a bus ran this season. The utility players of the fleet.',
        better: 'higher',
        betterLabel: 'HIGHER IS BETTER',
        calc: 'Every distinct route the bus ran at least one trip on this season. Bus only.',
    },
    'last-seen': {
        name: 'Last Seen',
        section: 'availability',
        short: 'The most recent service day this car ran a trip, in any season.',
        lead: 'The most recent service day this car ran a trip.',
        better: 'none',
        betterLabel: 'NOT RANKED',
        calc: 'Taken from all the data we have, not just the season shown. A car not seen in weeks is usually in the shop, held as a spare or retired.',
    },
};

const isStatId = (k: string): k is StatId => Object.hasOwn(GLOSSARY, k);

export const STAT_IDS = Object.keys(GLOSSARY).filter(isStatId);

export interface RankingsParagraph {
    /** Bold lead-in; empty for a continuation paragraph. */
    lead: string;
    body: string;
    /** Illustrate the percentile scale above this paragraph. */
    scale?: boolean;
}

export const HOW_RANKINGS: RankingsParagraph[] = [
    {
        lead: 'Every car is a player.',
        body: 'When a six-car train makes a trip, all six cars get credit for it. Over a season, cars get coupled into many different trains, so their own tendencies show through.',
    },
    {
        lead: 'Percentiles compare a car with its own line.',
        body: 'Red Line cars are ranked against Red Line cars, and buses against buses. Green Line branches are pooled because the same cars run on all of them. Mattapan’s handful of trolleys get stats but aren’t ranked.',
    },
    {
        lead: '',
        scale: true,
        body: 'A 95 means the car beat 95% of qualified cars on its line. Red is good and blue is not, whatever the stat.',
    },
    {
        lead: 'Too close to call.',
        body: 'When a line’s cars are within a hair of each other on a stat, a percentile would only exaggerate tiny differences. Those stats are shown without percentiles and marked too close to call. Boards with fewer than 5 ranked cars get no percentiles either.',
    },
    {
        lead: 'Qualifying.',
        body: 'A car needs enough trips in the season to be ranked: at least 50, and at least a quarter of what a typical car on its line ran. Cars below that still get a page, just without percentile bubbles.',
    },
    {
        lead: 'Married pairs.',
        body: 'Many rapid-transit cars are permanently coupled in pairs, like 1902 and 1903. They always run together, so they share identical stats.',
    },
    {
        lead: 'Fair comparisons.',
        body: 'A car’s times are always compared on the same stretch of track, in the same direction, at the same time of day and day of week. A car that works rush hours isn’t penalized for traffic it can’t avoid. Delays longer than five minutes count as five minutes, so one bad breakdown doesn’t decide a season.',
    },
];

export const LEDE =
    'Every MBTA train car and bus gets a stat line here, built nightly from the T’s own arrival and departure records. This page explains what each number means and how cars are ranked.';
