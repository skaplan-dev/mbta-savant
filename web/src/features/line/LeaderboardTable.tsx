import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CarStats } from '../../api';
import CarPill from '../../components/CarPill';
import StatTerm from '../../components/StatTerm';
import { fmtInt, pctColor, tint } from '../../format';
import { GROUPS, type GroupId } from '../../groups';
import { boardStats } from '../../stats';
import { firstDir, sortCars, type Sort, type SortKey } from './leaderboard';

const th =
    'border-panel-line bg-wash border-b px-2 py-2 text-left align-bottom text-ui font-medium leading-tight whitespace-nowrap aria-[sort=ascending]:text-brand aria-[sort=descending]:text-brand';

const td = 'border-panel-line border-b px-2 py-1.5 whitespace-nowrap';

// Rank and Car stay pinned while the table scrolls sideways on narrow screens. Rank is a fixed 72px
// so Car's left offset lines up; both need an opaque background so scrolled cells don't show through.
const stickyRank = 'sticky left-0 z-[1] w-[72px] min-w-[72px]';
const stickyCar = 'sticky left-[72px] z-[1] shadow-[1px_0_0_var(--color-panel-line)]';

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
    const Chevron = dir === 'asc' ? ChevronUp : dir === 'desc' ? ChevronDown : ChevronsUpDown;

    return (
        <button
            type="button"
            onClick={() => toggle(k)}
            aria-label={`Sort by ${label}`}
            className="hover:bg-panel-line/60 ml-0.5 inline-grid size-5 cursor-pointer place-items-center rounded border-0 bg-transparent p-0 align-[-3px]"
        >
            <Chevron className={`size-4 ${dir ? 'text-brand' : 'text-ink-3'}`} strokeWidth={2.5} />
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
                <table className="text-ui w-full border-collapse">
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
                                                <small className="text-ink text-meta ml-1.5">
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
