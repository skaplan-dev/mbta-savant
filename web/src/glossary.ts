// Single source for stat definitions: used by the stat popovers and the Glossary page.

export type StatId =
    | 'tar'
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
    /** One-sentence definition: the stat popover and the Glossary's first line. */
    lead: string;
    better: 'higher' | 'lower' | 'none';
    /** Label shown beside the name on the Glossary page. */
    betterLabel: string;
    /** Only what the lead leaves out; omit when there's nothing to add. */
    calc?: string;
    example?: string;
}

export const GLOSSARY: Record<StatId, GlossaryEntry> = {
    tar: {
        name: 'TAR',
        section: 'performance',
        lead: 'Trips Above Replacement: how many more trips’ worth of service this car gave than a replacement-level car on its line.',
        better: 'higher',
        betterLabel: 'HIGHER IS BETTER',
        calc: 'Built from showing up, speed and steadiness. See How TAR is calculated above.',
        example: '+210 = about 210 more trips than a replacement car',
    },
    'time-saved': {
        name: 'Time Saved',
        section: 'performance',
        lead: 'Seconds of travel time this car saves per trip compared with its line’s typical car.',
        better: 'higher',
        betterLabel: 'HIGHER IS BETTER',
        calc: 'Moving time only, from leaving one stop to reaching the next. The % is the same saving as a share of the trip.',
        example: '+32 s · +1.8% = 32 seconds quicker per trip',
    },
    'dwell-time': {
        name: 'Dwell Time',
        section: 'performance',
        lead: 'Seconds this car saves per trip while stopped at stations, compared with its line’s typical car.',
        better: 'higher',
        betterLabel: 'HIGHER IS BETTER',
        calc: 'Crowds and operators affect dwell as much as the car does.',
        example: '+12 s = 12 seconds less at stops per trip',
    },
    'on-schedule': {
        name: 'On-Schedule %',
        section: 'performance',
        lead: 'How often this car makes the MBTA’s scheduled time between stops.',
        better: 'higher',
        betterLabel: 'HIGHER IS BETTER',
        calc: 'Schedules are in whole minutes, so most short hops count as on time.',
    },
    consistency: {
        name: 'Consistency',
        section: 'performance',
        lead: 'How much this car’s stop-to-stop times vary, in seconds.',
        better: 'lower',
        betterLabel: 'SMALLER IS BETTER',
        calc: 'Only variation counts: a car that’s always a little slow can still score well.',
    },
    'days-in-service': {
        name: 'Days in Service',
        section: 'availability',
        lead: 'Share of the line’s service days that this car was out carrying passengers.',
        better: 'higher',
        betterLabel: 'HIGHER IS BETTER',
        calc: 'A day counts after 2 trips on rail, 1 on a bus. New cars count from their first day. A low number usually means shop time or spare duty.',
    },
    'iron-horse': {
        name: 'Iron Horse Streak',
        section: 'availability',
        lead: 'Most service days in a row this car ran this season.',
        better: 'higher',
        betterLabel: 'HIGHER IS BETTER',
        calc: 'Named for ballplayers who never miss a game. Data outages don’t break a streak.',
    },
    miles: {
        name: 'Miles Logged',
        section: 'availability',
        lead: 'Miles this car carried passengers this season.',
        better: 'higher',
        betterLabel: 'HIGHER IS BETTER',
        calc: 'Rail only. Trips to and from the yard don’t count.',
    },
    crowding: {
        name: 'Avg Crowding',
        section: 'fun',
        lead: 'Average load as a share of capacity, from on-board passenger counters.',
        better: 'none',
        betterLabel: 'NOT RANKED',
        calc: 'Only newer cars report it, so it isn’t ranked.',
    },
    'coupled-with': {
        name: 'Coupled With',
        section: 'fun',
        lead: 'The cars this one most often runs coupled to, and on what share of its trips.',
        better: 'none',
        betterLabel: 'NOT RANKED',
        calc: 'A married partner always shows 100%.',
    },
    'routes-run': {
        name: 'Routes Run',
        section: 'availability',
        lead: 'How many different routes a bus ran this season: the fleet’s utility players.',
        better: 'higher',
        betterLabel: 'HIGHER IS BETTER',
    },
    'last-seen': {
        name: 'Last Seen',
        section: 'availability',
        lead: 'The last day this car carried passengers, in any season.',
        better: 'none',
        betterLabel: 'NOT RANKED',
        calc: 'Weeks without a sighting usually means the shop, spare duty or retirement.',
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
    /** Render as an item in a list with its neighbouring items. */
    item?: boolean;
}

export const HOW_RANKINGS: RankingsParagraph[] = [
    {
        lead: 'Every car is a player.',
        body: 'When a six-car train makes a trip, all six cars get credit.',
    },
    {
        lead: 'Ranked within its line.',
        body: 'Red Line cars against Red Line cars, buses against buses. Green Line branches are pooled. Mattapan isn’t ranked.',
    },
    {
        lead: '',
        scale: true,
        body: 'A 95 beat 95% of qualified cars on its line. Red is good, blue isn’t.',
    },
    {
        lead: 'Fair comparisons.',
        body: 'Times are compared on the same stretch, direction, hour and day type, against the line’s typical (median) car. Delays over five minutes count as five.',
    },
    {
        lead: 'Qualifying.',
        body: 'A car needs at least 50 trips, and a quarter of what a typical car ran, to be ranked.',
    },
    {
        lead: 'Married pairs.',
        body: 'Permanently coupled pairs, like 1902 and 1903, share identical stats.',
    },
];

export const HOW_TAR: RankingsParagraph[] = [
    {
        lead: 'The idea.',
        body: 'Baseball’s WAR, counted in trips: how much more service a car gave than a replacement-level car (the line’s 20th-percentile car) would have.',
    },
    {
        lead: 'TAR = On the field + Speed + Steadiness,',
        body: 'each turned into trips:',
    },
    {
        lead: 'On the field:',
        body: 'extra days in service × trips a car makes in a typical day.',
        item: true,
    },
    {
        lead: 'Speed:',
        body: 'seconds saved per trip (travel plus dwell) × trips run ÷ a typical trip’s length.',
        item: true,
    },
    {
        lead: 'Steadiness:',
        body: 'seconds of variation saved, compared on the same segments, converted the same way.',
        item: true,
    },
    {
        lead: 'Example.',
        body: 'A car that ran 20 more days than replacement, on a line where cars make 10 trips a day, earns +200 from showing up alone.',
    },
    {
        lead: 'Keep in mind.',
        body: 'TAR is mostly about showing up, by design. Compare it only within a line. On-Schedule % is left out because it mostly repeats speed.',
    },
];

export const LEDE =
    'Every MBTA train car and bus, ranked from the T’s own arrival and departure records and updated nightly.';
