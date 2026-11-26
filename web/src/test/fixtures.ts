import type { Car, CareerCar, CarStats, GroupFile, IndexEntry, Pct, SeasonRow } from '../api';

// Complete, valid records with neutral defaults, so tests state only the fields they care about.

const pct = (o: Partial<Pct> = {}): Pct => ({
    tar: 50,
    travel_time_sec: 50,
    dwell_time_sec: 50,
    on_time_pct: 50,
    steadiness_sec: 50,
    games_played_pct: 50,
    iron_horse_days: 50,
    miles: 50,
    routes: null,
    crowd_load_pct: null,
    ...o,
});

export const indexEntry = (number: string, o: Partial<IndexEntry> = {}): IndexEntry => ({
    car_id: `${o.group ?? 'red'}:${number}`,
    group: 'red',
    number,
    fleet_label: 'F',
    qualified: true,
    ranked: true,
    travel_vs_typical_sec: 0,
    pct_travel: 50,
    ...o,
});

export const carStats = (
    number: string,
    o: Partial<Omit<CarStats, 'pct'>> & { pct?: Partial<Pct> } = {}
): CarStats => ({
    car_id: `red:${number}`,
    number,
    trips: 100,
    qualified: true,
    ranked: true,
    on_time_pct: 90,
    steadiness_sec: 10,
    games_played_pct: 50,
    iron_horse_days: 5,
    miles: 1000,
    routes: null,
    crowd_load_pct: null,
    teammates: [],
    vehicle: { fleet_key: 'k', fleet_label: 'F' },
    ...o,
    pct: pct(o.pct),
});

export const car = (number: string, o: Partial<Car> = {}): Car => ({
    ...carStats(number, o),
    game_log: o.game_log ?? [],
});

export const groupFile = (cars: CarStats[], o: Partial<GroupFile> = {}): GroupFile => ({
    group: 'red',
    window: '2026',
    generated_at: '',
    qualify_min_trips: 870,
    segs_per_trip: null,
    typical: {},
    too_close: [],
    cars,
    ...o,
});

export const seasonRow = (season: string, o: Partial<SeasonRow> = {}): SeasonRow => ({
    season,
    trips: 1000,
    qualified: true,
    ranked: true,
    travel_vs_typical_sec: 0,
    travel_vs_typical_pct: 0,
    pct_travel: 50,
    on_time_pct: 90,
    games_played_pct: 50,
    miles: 10000,
    iron_horse_days: 5,
    tar: 100,
    pct_tar: 50,
    fleet_label: 'F',
    ...o,
});

export const careerCar = (
    number: string,
    o: Partial<Omit<CareerCar, 'pct'>> & { pct?: Partial<Pct> } = {}
): CareerCar => {
    const seasons = o.seasons ?? [seasonRow('2026')];

    return {
        ...carStats(number, o),
        game_log: [],
        seasons,
        windows: o.windows ?? seasons.map((s) => s.season),
        seasons_played: o.seasons_played ?? seasons.length,
    };
};
