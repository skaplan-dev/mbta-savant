// Single source for stat definitions: used by the tooltips and the Glossary page.
// Copy is verbatim from docs/design/mockups (car_template.html, glossary.html).

export type StatId =
    | 'time-saved'
    | 'pace-plus'
    | 'on-schedule'
    | 'consistency'
    | 'door-time'
    | 'days-in-service'
    | 'iron-horse'
    | 'miles'
    | 'cruise-speed'
    | 'crowding'
    | 'coupled-with'
    | 'routes-run';

export interface GlossaryEntry {
    name: string;
    section: 'performance' | 'workload' | 'fun';
    /** Tooltip copy. */
    short: string;
    /** Glossary lead sentence. */
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
        short: 'Seconds this car saves per stop-to-stop hop compared with the average car on its line, on the same stretches at the same times of day. Bigger is better.',
        lead: 'Seconds this car saves on each stop-to-stop hop compared with the average car on its line.',
        better: 'higher',
        betterLabel: 'HIGHER IS BETTER',
        calc: 'For every hop, we compare the car’s time with the typical time for that stretch, direction, hour and day type, then average across the season. The result is shown relative to the line’s average car, so about half of all cars are positive.',
        example: '+2.9 s means this car is about 3 seconds quicker per stop than the average car',
    },
    'pace-plus': {
        name: 'Pace+',
        section: 'performance',
        short: 'Speed on a 100 scale: 100 is the line’s average car; 105 means 5% quicker on the same stretches.',
        lead: 'Speed on a 100 scale: 100 is the line’s average car.',
        better: 'higher',
        betterLabel: 'HIGHER IS BETTER',
        calc: 'Total expected travel time divided by the car’s actual travel time, centered so the average car is 100. Like baseball’s “plus” stats, 110 is 10% better than average and 90 is 10% worse.',
        example: '103 means 3% quicker than the average car on the same trips',
    },
    'on-schedule': {
        name: 'On-Schedule %',
        section: 'performance',
        short: 'Share of stop-to-stop hops completed at or under the MBTA’s scheduled time.',
        lead: 'Share of stop-to-stop hops the car completed at or under the MBTA’s scheduled time.',
        better: 'higher',
        betterLabel: 'HIGHER IS BETTER',
        calc: 'Uses the T’s own scheduled travel time for each hop. Schedules are published in whole minutes, so most short hops count as on schedule. The spread between cars is small but real.',
    },
    consistency: {
        name: 'Consistency',
        section: 'performance',
        short: 'How much this car’s hop times vary. A smaller spread means more predictable trips.',
        lead: 'How much this car’s hop times vary from trip to trip.',
        better: 'lower',
        betterLabel: 'SMALLER SPREAD IS BETTER',
        calc: 'The spread of the middle half of the car’s hop times, after adjusting each hop for its stretch and time of day. A 6 s spread means most hops land within a few seconds of what you’d expect.',
    },
    'door-time': {
        name: 'Door Time',
        section: 'performance',
        short: 'Time stopped at stations compared with a typical stop at the same station and hour.',
        lead: 'Time stopped at stations compared with a typical stop at the same station and hour.',
        better: 'lower',
        betterLabel: 'QUICKER IS BETTER',
        calc: 'The car’s median dwell minus the typical dwell. Door time depends on crowds and operators as much as on the car, so take it as a fun stat, not a verdict.',
        example: '“2 s quick” means it usually leaves 2 seconds sooner than a typical stop',
    },
    'days-in-service': {
        name: 'Days in Service',
        section: 'workload',
        short: 'Share of service days this car carried riders.',
        lead: 'Share of service days this car carried riders.',
        better: 'higher',
        betterLabel: 'HIGHER IS BETTER',
        calc: 'Only days when the line ran and reported data count, so a system outage doesn’t hurt anyone. A low number usually means time in the shop, or a car held as a spare.',
    },
    'iron-horse': {
        name: 'Iron Horse Streak',
        section: 'workload',
        short: 'Longest run of consecutive service days in service.',
        lead: 'Longest run of consecutive service days in service this season.',
        better: 'higher',
        betterLabel: 'HIGHER IS BETTER',
        calc: 'Named for the baseball nickname for players who never miss a game.',
    },
    miles: {
        name: 'Miles Logged',
        section: 'workload',
        short: 'Distance carried in passenger service this season.',
        lead: 'Distance carried in passenger service this season.',
        better: 'higher',
        betterLabel: 'HIGHER IS BETTER',
        calc: 'Station-to-station distances added up over every hop. Rail only for now, because bus stop-to-stop distances aren’t in the data yet.',
    },
    'cruise-speed': {
        name: 'Cruise Speed',
        section: 'fun',
        short: 'A fast-but-typical speed between stations (90th percentile). Mostly reflects the track, so it isn’t ranked.',
        lead: 'A fast-but-typical speed between stations: the 90th percentile of the car’s hop speeds.',
        better: 'none',
        betterLabel: 'NOT RANKED',
        calc: 'This mostly reflects the line’s longest, fastest stretches, which every car on the line runs, so it says more about the track than the car.',
    },
    crowding: {
        name: 'Avg Crowding',
        section: 'fun',
        short: 'Average share of capacity, from on-board passenger counters. Only newer cars report it.',
        lead: 'Average share of capacity, from on-board passenger counters.',
        better: 'none',
        betterLabel: 'NOT RANKED',
        calc: 'Only newer cars (such as the Red and Orange Line CRRC cars) report it, so it would be unfair to rank.',
    },
    'coupled-with': {
        name: 'Coupled With',
        section: 'fun',
        short: 'The cars this car most often runs coupled to, and how many trips they shared.',
        lead: 'The cars this car most often runs coupled to, and how many trips they shared.',
        better: 'none',
        betterLabel: 'NOT RANKED',
        calc: 'A car’s married partner shows up at 100%.',
    },
    'routes-run': {
        name: 'Routes Run',
        section: 'fun',
        short: 'How many different routes a bus ran this season. The utility players of the fleet.',
        lead: 'How many different routes a bus ran this season. The utility players of the fleet.',
        better: 'none',
        betterLabel: 'BUS ONLY',
        calc: '',
    },
};

const isStatId = (k: string): k is StatId => Object.hasOwn(GLOSSARY, k);

/** Glossary order. */
export const STAT_IDS = Object.keys(GLOSSARY).filter(isStatId);

export interface RankingsParagraph {
    /** Bold lead-in; empty for a continuation paragraph. */
    lead: string;
    body: string;
    /** Illustrate the percentile scale above this paragraph. */
    scale?: boolean;
}

// "How rankings work".
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
