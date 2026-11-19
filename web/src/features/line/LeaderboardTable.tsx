import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CarStats } from '../../api';
import CarPill from '../../components/CarPill';
import StatTerm from '../../components/StatTerm';
import { fmtDate, fmtInt, pctColor, tint } from '../../format';
import { GROUPS, type GroupId } from '../../groups';
import { boardStats, type Stat } from '../../stats';
import { firstDir, sortCars, type Sort, type SortKey, type RankedRow } from './leaderboard';

const th =
    'border-panel-line bg-wash border-b px-2 py-2 text-left align-bottom text-ui font-medium leading-tight whitespace-nowrap aria-[sort=ascending]:text-brand aria-[sort=descending]:text-brand';

const td = 'border-panel-line border-b px-2 py-1.5 whitespace-nowrap';

// Rank and Car stay pinned while the table scrolls sideways on narrow screens. Rank is a fixed 72px
// so Car's left offset lines up; both need an opaque background so scrolled cells don't show through.
const stickyRank = 'sticky left-0 z-[1] w-[72px] min-w-[72px]';
const stickyCar = 'sticky left-[72px] z-[1] shadow-[1px_0_0_var(--color-panel-line)]';

const VIRTUAL_MIN_ROWS = 300;
const ROW_ESTIMATE_PX = 41;

const Spacer = ({ height }: { height: number }) =>
    height > 0 ? (
        <tr aria-hidden="true">
            <td style={{ height, padding: 0, border: 0 }} />
        </tr>
    ) : null;

function LeaderRow({
    ref,
    index,
    row: { car, rank },
    group,
    season,
    cols,
}: {
    ref?: (el: HTMLTableRowElement | null) => void;
    index: number;
    row: RankedRow;
    group: GroupId;
    season: string;
    cols: readonly Stat[];
}) {
    return (
        <tr ref={ref} data-index={index}>
            <td className={`${td} ${stickyRank} text-ink-2 bg-white`}>{rank}</td>
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
                        style={pct == null ? undefined : { background: tint(pctColor(pct)) }}
                    >
                        {c.text(car)}
                        {pct != null && <small className="text-ink text-meta ml-1.5">{pct}</small>}
                    </td>
                );
            })}
            <td className={`${td} text-ink-2`}>{fmtDate(car.last_seen)}</td>
        </tr>
    );
}

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
    cols = boardStats(group),
}: {
    group: GroupId;
    season: string;
    ranked: CarStats[];
    /** Stat columns; the group's board stats unless a page drops some (a route board has no Routes Run). */
    cols?: readonly Stat[];
}) {
    const [sort, setSort] = useState<Sort>({ key: 'time-saved', dir: 'desc' });
    const rows = useMemo(() => sortCars(ranked, sort, group), [ranked, sort, group]);

    const toggle = (key: SortKey) =>
        setSort((s) =>
            s.key === key
                ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
                : { key, dir: firstDir(key, group) }
        );

    // The bus board has ~1,100 rows; render only those near the viewport. Smaller boards render whole,
    // so find-in-page still works there. Spacer rows keep the real table (and its sticky columns).
    const virtual = rows.length > VIRTUAL_MIN_ROWS;
    const bodyRef = useRef<HTMLTableSectionElement>(null);
    const [margin, setMargin] = useState(0);

    // The window scrolls, so the virtualizer needs the tbody's distance from the top of the page,
    // which moves when content above it (fleet strip, route picker) loads or the layout reflows.
    useLayoutEffect(() => {
        const body = bodyRef.current;

        if (!virtual || !body) return;
        const measure = () => setMargin(body.getBoundingClientRect().top + window.scrollY);

        measure();
        const ro = new ResizeObserver(measure);

        ro.observe(document.body);

        return () => ro.disconnect();
    }, [virtual]);

    // TanStack Virtual returns a mutable instance the React Compiler can't memoize; the compiler isn't
    // in this build, and the rule would just skip memoizing this component anyway.
    // oxlint-disable-next-line react/incompatible-library
    const virtualizer = useWindowVirtualizer({
        count: rows.length,
        estimateSize: () => ROW_ESTIMATE_PX,
        overscan: 15,
        scrollMargin: margin,
        enabled: virtual,
    });
    const items = virtual ? virtualizer.getVirtualItems() : null;
    const rowProps = { group, season, cols };

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
                            <th scope="col" aria-sort={aria('last-seen')} className={th}>
                                <StatTerm id="last-seen" />
                                <SortBtn
                                    sort={sort}
                                    toggle={toggle}
                                    k="last-seen"
                                    label="last seen"
                                />
                            </th>
                        </tr>
                    </thead>
                    <tbody ref={bodyRef}>
                        {items ? (
                            <>
                                <Spacer height={(items[0]?.start ?? margin) - margin} />
                                {items.map((item) => (
                                    <LeaderRow
                                        key={rows[item.index].car.car_id}
                                        ref={virtualizer.measureElement}
                                        index={item.index}
                                        row={rows[item.index]}
                                        {...rowProps}
                                    />
                                ))}
                                <Spacer
                                    height={
                                        virtualizer.getTotalSize() -
                                        ((items.at(-1)?.end ?? margin) - margin)
                                    }
                                />
                            </>
                        ) : (
                            rows.map((row, i) => (
                                <LeaderRow key={row.car.car_id} index={i} row={row} {...rowProps} />
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
