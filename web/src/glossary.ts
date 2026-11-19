// Single source for stat definitions: used by the stat popovers and the Glossary page.

export type StatId =
    | 'time-saved'
    | 'pace-plus'
    | 'on-schedule'
    | 'consistency'
    | 'door-time'
    | 'days-in-service'
    | 'iron-horse'
    | 'miles'
    | 'crowding'
    | 'coupled-with'
    | 'routes-run'
    | 'last-seen';

export interface GlossaryEntry {
    name: string;
    section: 'performance' | 'workload' | 'fun';
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
        short: 'Seconds of travel time this car saves between each pair of stops, compared with the line’s average car on the same segments at the same times. Dwell time at stops is not included.',
        lead: 'Seconds of travel time this car saves between each pair of stops, compared with the line’s average car.',
        better: 'higher',
        betterLabel: 'HIGHER IS BETTER',
        calc: 'Travel time runs from leaving one stop to arriving at the next, so it covers time moving, not time at the platform (that’s Door Time). For every segment the car runs, we compare its travel time with the median for that segment, direction, hour and day type, counting any delay past five minutes as five minutes. We average those differences over the season and show the result relative to the line’s average car (the mean of all ranked cars).',
        example: '+2.9 s means about 3 seconds less travel time per segment than the average car',
    },
    'pace-plus': {
        name: 'Pace',
        section: 'performance',
        short: 'How much faster this car’s travel times between stops are than the line’s average car, as a percentage. Dwell time at stops is not included.',
        lead: 'How much faster this car’s travel times between stops are than the line’s average car, as a percentage.',
        better: 'higher',
        betterLabel: 'HIGHER IS BETTER',
        calc: 'Total expected travel time over every segment the car ran, divided by its actual travel time, shown relative to the line’s average car. It measures the same travel times as Time Saved: Time Saved is the average difference per segment in seconds, while Pace is the overall difference as a percentage, so long segments count for more.',
        example: '+3.2% means travel times about 3% shorter than the average car’s',
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
    'door-time': {
        name: 'Door Time',
        section: 'performance',
        short: 'Dwell time at stops compared with the line’s average car, at the same stops and times. Travel time between stops is not included.',
        lead: 'Dwell time at stops compared with the line’s average car, at the same stops and times.',
        better: 'lower',
        betterLabel: 'SHORTER IS BETTER',
        calc: 'Dwell time runs from arriving at a stop to leaving it. At each stop, we compare the car’s dwell with the median dwell there for the same direction, hour and day type, counting anything past 30 seconds as 30. We average those differences and show the result relative to the line’s average car. Dwell depends on crowds and operators as much as on the car, so take it as a fun stat, not a verdict.',
        example: '“0.8 s quick” means about 0.8 seconds less dwell per stop than the average car',
    },
    'days-in-service': {
        name: 'Days in Service',
        section: 'workload',
        short: 'Share of this season’s service days on which this car ran at least one trip.',
        lead: 'Share of this season’s service days on which this car ran at least one trip.',
        better: 'higher',
        betterLabel: 'HIGHER IS BETTER',
        calc: 'Only days when the line ran and reported data count, so a data outage doesn’t hurt anyone. A low number usually means time in the shop, or a car held as a spare.',
    },
    'iron-horse': {
        name: 'Iron Horse Streak',
        section: 'workload',
        short: 'Most consecutive service days this car ran this season.',
        lead: 'Most consecutive service days this car ran this season.',
        better: 'higher',
        betterLabel: 'HIGHER IS BETTER',
        calc: 'Days when the whole line reported no data are skipped, so an outage doesn’t break a streak. Named for the baseball nickname for players who never miss a game.',
    },
    miles: {
        name: 'Miles Logged',
        section: 'workload',
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
        section: 'workload',
        short: 'How many different routes a bus ran this season. The utility players of the fleet.',
        lead: 'How many different routes a bus ran this season. The utility players of the fleet.',
        better: 'higher',
        betterLabel: 'HIGHER IS BETTER',
        calc: 'Every distinct route the bus ran at least one trip on this season. Bus only.',
    },
    'last-seen': {
        name: 'Last Seen',
        section: 'workload',
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
