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
    short: string;
    lead: string;
    better: 'higher' | 'lower' | 'none';
    /** Label shown beside the name on the Glossary page. */
    betterLabel: string;
    calc: string;
    example?: string;
}

export const GLOSSARY: Record<StatId, GlossaryEntry> = {
    tar: {
        name: 'TAR',
        section: 'performance',
        short: 'Trips Above Replacement: how many more trips’ worth of service this car gave its line this season than a replacement-level car would have.',
        lead: "Trips Above Replacement: how many more trips' worth of service this car gave its line this season than a replacement-level car would have.",
        better: 'higher',
        betterLabel: 'HIGHER IS BETTER',
        calc: 'It adds up three things: how often the car showed up, how much time it saved per trip, and how steady it was, each measured against a replacement-level car (the 20th-percentile car on that part) and turned into trips. Most of the total is usually showing up, by design. Only compare TAR between cars on the same line; see How TAR is calculated for the formulas.',
        example: '+210 means about 210 trips’ worth more than a replacement car',
    },
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
        lead: 'Close races.',
        body: 'When a line’s cars are within a hair of each other on a stat, small differences still move a car’s percentile a lot. Those stats are still ranked, and the page notes how close the race is: for example, “8 in 10 cars within 0.4 s of each other.” Boards with fewer than 5 ranked cars are ranked too, but their percentiles are rough.',
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

export const HOW_TAR: RankingsParagraph[] = [
    {
        lead: 'The idea.',
        body: 'Baseball’s WAR asks how many wins a player added over a freely available replacement. TAR asks how many trips’ worth of service a car added over a replacement-level car on its own line. It is a season total, so a car that keeps running builds it up and a car in the shop does not.',
    },
    {
        lead: 'What “replacement” means.',
        body: 'For each of the three parts below, the replacement car is the line’s 20th-percentile car: the value that 1 in 5 ranked cars falls below, taking worse as lower. Only ranked cars count (qualified and listed on the roster). With fewer than 5 cars having a value, that part has no replacement level and counts as 0. A car’s part is how far it sits above that level, so a car below it can have a negative part.',
    },
    {
        lead: 'Part 1, on the field.',
        body: 'Days in service ÷ eligible days is the car’s service share. Field trips = (service share − replacement share) × eligible days × trips per day. In words: the extra days the car showed up compared with a replacement car over the same stretch, times what a car typically does in a day.',
    },
    {
        lead: 'Part 2, speed.',
        body: 'Seconds saved per trip is travel time saved plus dwell time saved against the line’s typical car, or travel time alone if the car has no dwell data. Speed trips = (seconds saved − replacement seconds saved) × trips ÷ typical trip length. In words: the seconds saved per trip, added up over every trip the car ran, expressed as whole trips’ worth of time.',
    },
    {
        lead: 'Part 3, steadiness.',
        body: 'Steady trips = (adjusted steadiness − replacement) × segments per trip × trips ÷ typical trip length. Adjusted steadiness is the seconds of variation saved per segment, treated like time saved because riders have to budget for variation. It is route-adjusted: a car’s variation on each segment (same route, direction, stops, hour and day type) is compared with the average car’s on that same segment, so a car is not marked down for working a rougher stretch. Only segments with at least 20 runs in the season count, and if fewer than half of a car’s runs are on such segments, the part is not measured and counts as 0.',
    },
    {
        lead: 'Total.',
        body: 'TAR = field trips + speed trips + steady trips. Each part is rounded to whole trips on its own, so the three parts shown on a car page can differ from the total by a trip. A part that is not measured counts as replacement level: neither rewarded nor penalized.',
    },
    {
        lead: 'Where the conversion rates come from.',
        body: 'Trips per day is the median, over ranked cars on the line, of each car’s trips ÷ days in service. Typical trip length is the median trip in the season, from first departure to last arrival. Segments per trip is the line’s average. Bus route boards use the same recipe with that route’s own numbers, among buses on that route.',
    },
    {
        lead: 'New cars.',
        body: 'Eligible days are the days the line reported data, counted only from the car’s first service day on. A car that joined the fleet mid-season is not penalized for days before it existed. A service day is a day the car ran at least 2 trips on rail (1 on a bus), so a car that only rolled out of the yard for one trip does not count.',
    },
    {
        lead: 'Why On-Schedule % is left out.',
        body: 'On-Schedule % is mostly the same fact as Time Saved: a faster car is more often within the schedule. Including both would count speed twice.',
    },
    {
        lead: 'Worked example.',
        body: 'Illustrative numbers, not a real car. A rail line’s replacement car ran on 70% of eligible days, a typical car makes 10 trips per day, and a typical trip takes 3,000 seconds with 25 segments. Our car was eligible for 100 days and ran on 90 of them (a 90% share), made 900 trips, saved 20 seconds a trip against a replacement’s 6, and was 0.8 seconds per segment steadier than replacement. Field: (0.90 − 0.70) × 100 × 10 = +200. Speed: (20 − 6) × 900 ÷ 3,000 = +4.2, shown as +4. Steadiness: 0.8 × 25 × 900 ÷ 3,000 = +6. TAR = 200 + 4 + 6 = +210.',
    },
    {
        lead: 'Caveats.',
        body: 'Only compare TAR between cars on the same line, never across lines: each line has its own replacement level and trip rates. TAR mostly measures availability by design, since showing up is most of what a car can give its line; a car in the shop for repairs or held as a spare scores lower through no fault of anyone running it. Dwell time is real time that riders spend waiting, but its cause is unknown: it can reflect crowds, operators or how arrivals and departures are recorded, so TAR does not assign it to anyone.',
    },
];

export const LEDE =
    'Every MBTA train car and bus gets a stat line here, built nightly from the T’s own arrival and departure records. This page explains what each number means and how cars are ranked.';
