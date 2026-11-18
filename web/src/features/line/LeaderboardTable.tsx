import { useMemo, useState } from 'react';
import type { CarStats } from '../../api';
import CarPill from '../../components/CarPill';
import StatTerm from '../../components/StatTerm';
import { fmtInt, pctColor, tint } from '../../format';
import { GROUPS, type GroupId } from '../../groups';
import { boardStats } from '../../stats';
import { firstDir, sortCars, type Sort, type SortKey } from './leaderboard';

const th =
    'border-panel-line bg-wash border-b px-2 py-2 text-left align-bottom text-[17px] font-medium leading-tight whitespace-nowrap aria-[sort=ascending]:text-brand aria-[sort=descending]:text-brand';

const td = 'border-panel-line border-b px-2 py-1.5 whitespace-nowrap';

// Rank and Car stay pinned while the table scrolls sideways on narrow screens. Rank is a fixed 72px
// so Car's left offset lines up; both need an opaque background so scrolled cells don't show through.
const stickyRank = 'sticky left-0 z-[1] w-[72px] min-w-[72px]';
const stickyCar = 'sticky left-[72px] z-[1] shadow-[1px_0_0_var(--color-panel-line)]';

// Up and down chevrons; the one matching the sort direction is drawn in the brand color.
const CHEVRONS = [
    ['M1.5 5.5 5 2l3.5 3.5', 'asc'],
    ['M1.5 8.5 5 12l3.5-3.5', 'desc'],
] as const;

// Module scope on purpose: defined inside the table it would be a new component type every render,
// remounting the button on each sort and dropping keyboard focus.
function SortBtn({
    sort,
    toggle,
    k,
    label,
}: {
    sort: Sort;
    toggle: (key: SortKey) => void;
    k: SortKey;
    label: string;
}) {
    const dir = sort.key === k ? sort.dir : null;

    return (
        <button
            type="button"
            onClick={() => toggle(k)}
            aria-label={`Sort by ${label}`}
            className="hover:bg-panel-line/60 ml-0.5 inline-grid size-5 cursor-pointer place-items-center rounded border-0 bg-transparent p-0 align-[-3px]"
        >
            <svg
                viewBox="0 0 10 14"
                aria-hidden="true"
                fill="none"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-2.5"
            >
                {CHEVRONS.map(([d, chevronDir]) => (
                    <path
                        key={chevronDir}
                        d={d}
                        className={
                            dir === chevronDir
                                ? 'stroke-brand'
                                : dir
                                  ? 'stroke-ink-3/25'
                                  : 'stroke-ink-3/60'
                        }
                    />
                ))}
            </svg>
        </button>
    );
}

export default function LeaderboardTable({
    group,
    season,
    ranked,
}: {
    group: GroupId;
    season: string;
    ranked: CarStats[];
}) {
    const [sort, setSort] = useState<Sort>({ key: 'time-saved', dir: 'desc' });
    const cols = boardStats(group);
    const rows = useMemo(() => sortCars(ranked, sort, group), [ranked, sort, group]);

    const toggle = (key: SortKey) =>
        setSort((s) =>
            s.key === key
                ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
                : { key, dir: firstDir(key, group) }
        );

    const aria = (key: SortKey) =>
        sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';

    return (
        <section className="panel" aria-label="Leaderboard">
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[17px]">
                    <thead>
                        <tr>
                            <th
                                scope="col"
                                aria-sort={aria('rank')}
                                className={`${th} ${stickyRank}`}
                            >
                                Rank
                                <SortBtn sort={sort} toggle={toggle} k="rank" label="rank" />
                            </th>
                            <th
                                scope="col"
                                aria-sort={aria('car')}
                                className={`${th} ${stickyCar}`}
                            >
                                {GROUPS[group].noun}
                                <SortBtn sort={sort} toggle={toggle} k="car" label="car number" />
                            </th>
                            <th scope="col" aria-sort={aria('fleet')} className={th}>
                                Fleet
                                <SortBtn sort={sort} toggle={toggle} k="fleet" label="fleet" />
                            </th>
                            <th scope="col" aria-sort={aria('trips')} className={th}>
                                Trips
                                <SortBtn sort={sort} toggle={toggle} k="trips" label="trips" />
                            </th>
                            {cols.map((c) => (
                                <th key={c.id} scope="col" aria-sort={aria(c.id)} className={th}>
                                    <StatTerm id={c.id} />
                                    <SortBtn
                                        sort={sort}
                                        toggle={toggle}
                                        k={c.id}
                                        label={c.id.replace(/-/g, ' ')}
                                    />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(({ car, rank }) => (
                            <tr key={car.car_id}>
                                <td className={`${td} ${stickyRank} text-ink-2 bg-white`}>
                                    {rank}
                                </td>
                                <td className={`${td} ${stickyCar} bg-white`}>
                                    <CarPill group={group} number={car.number} season={season} />
                                </td>
                                <td
                                    className={`${td} text-ink-2 max-w-[150px] truncate`}
                                    title={car.vehicle.fleet_label}
                                >
                                    {car.vehicle.fleet_label}
                                </td>
                                <td className={td}>{fmtInt(car.trips)}</td>
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
