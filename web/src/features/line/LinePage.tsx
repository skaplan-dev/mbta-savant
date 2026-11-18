import { useMemo, useState } from 'react';
import type { CarStats, FleetSummary } from '../../api';
import CarPill, { tint } from '../../components/CarPill';
import DateBox from '../../components/DateBox';
import NotFound from '../../components/NotFound';
import SeasonToggle from '../../components/SeasonToggle';
import StatTerm from '../../components/StatTerm';
import { GROUPS, pacePlus, pctColor, seasonLabel, signed, type GroupId } from '../../format';
import { useFleets } from '../../queries';
import {
    firstDir,
    isRankedCar,
    rankCars,
    sortCars,
    statCols,
    unrankedCars,
    type Sort,
    type SortKey,
} from './leaderboard';
import { useGroup, useLineData } from './useLineData';

const th =
    'border-panel-line bg-wash border-b px-2 py-2 text-left text-[17px] font-medium leading-tight';
const td = 'border-panel-line border-b px-2 py-1.5 whitespace-nowrap';

export default function LinePage({
    group,
    season: requested,
}: {
    group: GroupId;
    season: string | undefined;
}) {
    const line = useLineData(group, requested);
    const season = line?.season ?? '';
    const { data: file, isPending } = useGroup(season, group);
    const { data: fleets } = useFleets(group);

    const ranked = useMemo(
        () => rankCars((file?.cars ?? []).filter((c) => isRankedCar(group, c))),
        [file, group]
    );
    const unranked = useMemo(
        () => unrankedCars(group, file?.cars ?? [], file?.qualify_min_trips),
        [file, group]
    );

    if (!line || (season && isPending))
        return <p className="text-ink-2 py-16 text-center text-xl">Loading…</p>;
    if (!file) return <NotFound />;

    const fleetList = Object.values(fleets?.[season] ?? {}).sort((a, b) => b.cars - a.cars);

    return (
        <main>
            <div className="mt-2 mb-[26px] flex flex-col justify-between gap-4 md:flex-row md:items-stretch">
                <DateBox latest={line.meta.latest_service_date} />
                <SeasonToggle options={line.windows} value={season} />
            </div>
            <h1 className="m-0 text-[34px] font-medium tracking-tight md:text-[46px]">
                <span
                    className="mr-3 inline-block size-[18px] rounded-full align-middle"
                    style={{ background: GROUPS[group].color }}
                />
                {seasonLabel(season)} {GROUPS[group].name} Leaderboard
            </h1>
            <p className="text-ink-2 mt-1.5 mb-6 text-lg md:text-xl">
                {group === 'mattapan'
                    ? 'Mattapan’s handful of trolleys get stats but aren’t ranked.'
                    : `${ranked.length.toLocaleString('en-US')} ranked cars. Click a column to sort; cars need ${file.qualify_min_trips.toLocaleString('en-US')} trips to qualify.`}
            </p>
            {fleetList.length > 0 && <FleetStrip fleets={fleetList} />}
            {ranked.length > 0 && <Table group={group} season={season} ranked={ranked} />}
            {unranked.length > 0 && <NotRanked group={group} season={season} rows={unranked} />}
        </main>
    );
}

function FleetStrip({ fleets }: { fleets: FleetSummary[] }) {
    return (
        <section aria-label="Fleets" className="mb-6">
            <h2 className="text-ink-3 m-0 mb-2 text-[15px] font-medium tracking-[0.08em]">
                FLEETS · MEDIAN
            </h2>
            <ul className="m-0 flex list-none gap-3 overflow-x-auto p-0 pb-2">
                {fleets.map((f) => {
                    const saved = f.median.ttoe_vs_avg_sec;
                    const pace = f.median.speed_vs_avg_pct;
                    return (
                        <li
                            key={f.fleet_label}
                            className="panel flex-none px-3.5 py-2.5"
                            style={{ minWidth: 190, maxWidth: 260 }}
                        >
                            <div className="truncate text-lg font-medium" title={f.fleet_label}>
                                {f.fleet_label}
                            </div>
                            <div className="text-ink-3 text-base">
                                {f.cars} car{f.cars === 1 ? '' : 's'}
                            </div>
                            <div className="mt-1.5 flex gap-4 text-lg">
                                <span>
                                    <b className="font-medium">
                                        {signed(saved == null ? null : -saved, 1, ' s')}
                                    </b>{' '}
                                    <span className="text-ink-3 text-base">saved</span>
                                </span>
                                <span>
                                    <b className="font-medium">
                                        {pace == null
                                            ? '–'
                                            : pacePlus({
                                                  speed_vs_avg_pct: pace,
                                                  ttoe_vs_avg_sec: null,
                                              })}
                                    </b>{' '}
                                    <span className="text-ink-3 text-base">Pace+</span>
                                </span>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

function Table({ group, season, ranked }: { group: GroupId; season: string; ranked: CarStats[] }) {
    const [sort, setSort] = useState<Sort>({ key: 'time-saved', dir: 'desc' });
    const cols = statCols(group);
    const rows = useMemo(() => sortCars(ranked, sort, group), [ranked, sort, group]);

    const toggle = (key: SortKey) =>
        setSort((s) =>
            s.key === key
                ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
                : { key, dir: firstDir(key, group) }
        );
    const aria = (key: SortKey) =>
        sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
    const arrow = (key: SortKey) => (sort.key === key ? (sort.dir === 'asc' ? '▲' : '▼') : '↕');
    const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
        <button
            type="button"
            onClick={() => toggle(k)}
            aria-label={`Sort by ${label}`}
            className={`ml-1 cursor-pointer border-0 bg-transparent p-0 text-[13px] ${sort.key === k ? 'text-brand' : 'text-ink-3'}`}
        >
            {arrow(k)}
        </button>
    );

    return (
        <section className="panel" aria-label="Leaderboard">
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[17px]">
                    <thead>
                        <tr>
                            <th scope="col" aria-sort={aria('rank')} className={th}>
                                Rank
                                <SortBtn k="rank" label="rank" />
                            </th>
                            <th scope="col" aria-sort={aria('car')} className={th}>
                                {group === 'bus' ? 'Bus' : 'Car'}
                                <SortBtn k="car" label="car number" />
                            </th>
                            <th scope="col" aria-sort={aria('fleet')} className={th}>
                                Fleet
                                <SortBtn k="fleet" label="fleet" />
                            </th>
                            <th scope="col" aria-sort={aria('trips')} className={th}>
                                Trips
                                <SortBtn k="trips" label="trips" />
                            </th>
                            {cols.map((c, i) => (
                                <th key={c.id} scope="col" aria-sort={aria(c.id)} className={th}>
                                    <StatTerm
                                        id={c.id}
                                        below
                                        align={
                                            i === 0
                                                ? 'left'
                                                : i >= cols.length - 3
                                                  ? 'right'
                                                  : 'center'
                                        }
                                    />
                                    <SortBtn k={c.id} label={c.id.replace(/-/g, ' ')} />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(({ car, rank }) => (
                            <tr key={car.car_id}>
                                <td className={`${td} text-ink-2`}>{rank}</td>
                                <td className={td}>
                                    <CarPill group={group} number={car.number} season={season} />
                                </td>
                                <td
                                    className={`${td} text-ink-2 max-w-[150px] truncate`}
                                    title={car.vehicle.fleet_label}
                                >
                                    {car.vehicle.fleet_label}
                                </td>
                                <td className={td}>{car.trips.toLocaleString('en-US')}</td>
                                {cols.map((c) => {
                                    const pct = car.pct[c.pct];
                                    return (
                                        <td
                                            key={c.id}
                                            className={td}
                                            style={
                                                pct == null
                                                    ? undefined
                                                    : { background: tint(pctColor(pct)) }
                                            }
                                        >
                                            {c.text(car)}
                                            {pct != null && (
                                                <small className="text-ink-2 ml-1.5 text-[13px]">
                                                    {pct}
                                                </small>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

function NotRanked({
    group,
    season,
    rows,
}: {
    group: GroupId;
    season: string;
    rows: { car: CarStats; reason: string }[];
}) {
    return (
        <section className="mt-10" aria-label="Not ranked">
            <h2 className="border-brand-2 m-0 mb-1 border-b pb-2 text-[26px] font-bold">
                Not ranked
            </h2>
            <p className="text-ink-2 mt-2 mb-3 text-lg">
                These cars have trips this season but no percentile ranking.
            </p>
            <ul className="m-0 grid list-none grid-cols-1 gap-x-8 p-0 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map(({ car, reason }) => (
                    <li
                        key={car.car_id}
                        className="flex items-center gap-3 border-b border-dashed border-[#d6e1e4] py-2"
                    >
                        <CarPill group={group} number={car.number} season={season} />
                        <span className="text-ink-2 text-base">
                            {car.trips.toLocaleString('en-US')} trips · {reason}
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}
