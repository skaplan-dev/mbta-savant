import type { Car, CarStats, GroupFile, IndexEntry, Pct } from '../api';

// Complete, valid records with neutral defaults, so tests state only the fields they care about.

const pct = (o: Partial<Pct> = {}): Pct => ({
    ttoe_sec: 50,
    speed_vs_expected_pct: 50,
    on_time_pct: 50,
    steadiness_sec: 50,
    door_time_sec: 50,
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
    ttoe_sec: 1,
    ttoe_vs_avg_sec: 0,
    pct_ttoe: 50,
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
    ttoe_sec: 5,
    speed_vs_expected_pct: 0,
    ttoe_vs_avg_sec: 0,
    speed_vs_avg_pct: 0,
    door_vs_avg_sec: 0,
    on_time_pct: 90,
    steadiness_sec: 10,
    door_time_sec: 0,
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
    averages: { ttoe_sec: null, speed_vs_expected_pct: null },
    cars,
    ...o,
});
