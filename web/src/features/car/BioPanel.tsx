import { Link } from '@tanstack/react-router';
import type { Car } from '../../api';
import StatTerm from '../../components/StatTerm';
import { GROW, useGrowIn } from '../../components/useGrowIn';
import { fmtNum, GROUPS, signed, timeSaved, type GroupId } from '../../format';
import CarArt from './CarArt';
import { marriedMate, routeCounts } from './shared';

const HERO_BG = 'linear-gradient(#eef3f5, #eef3f5 72%, #d9e3e6 72%, #d9e3e6 74%, #e4ebed 74%)';

const Sep = () => <span className="text-ink-3 mx-1.5">|</span>;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function BioPanel({
    group,
    number,
    car,
    cars,
    years,
    onTab,
}: {
    group: GroupId;
    number: string;
    car: Car;
    /** window → this car's file, for the season table. */
    cars: Record<string, Car | null>;
    /** Calendar-year windows with a file, newest first. */
    years: string[];
    onTab: (tab: 'log' | 'mates') => void;
}) {
    const { name: lineName, color } = GROUPS[group];
    const isBus = group === 'bus';
    const v = car.vehicle;
    const mate = isBus ? null : marriedMate(car);
    const kind = isBus ? 'Bus' : 'Car';

    const specs = [
        mate ? `Married pair: ${number}/${mate}` : null,
        v.length_ft ? `${v.length_ft} ft` : null,
        v.propulsion ? cap(v.propulsion) : null,
        isBus && v.garage ? `Garage: ${v.garage}` : null,
    ].filter((x): x is string => !!x);
    const built = [v.years ? `Built: ${v.years}` : null, v.fleet_label || 'Unknown fleet'].filter(
        (x): x is string => !!x
    );

    return (
        <section className="panel" aria-labelledby="carName">
            <div className="relative">
                <div className="relative h-[196px] overflow-hidden" style={{ background: HERO_BG }}>
                    <CarArt
                        group={group}
                        number={number}
                        mate={mate}
                        color={color}
                        lengthFt={v.length_ft}
                    />
                </div>
                <div
                    className={`absolute -bottom-12 left-1/2 grid size-24 -translate-x-1/2 place-items-center rounded-full border-4 border-white font-bold tracking-[0.01em] shadow-[0_3px_10px_rgb(0_0_0/0.18)] ${
                        number.length > 4 ? 'text-2xl' : 'text-[30px]'
                    } ${isBus ? 'text-ink' : 'text-white'}`}
                    style={{ background: color }}
                    aria-hidden="true"
                >
                    {number}
                </div>
            </div>
            <div className="px-[18px] pt-[58px] pb-1.5 text-center">
                <h1 id="carName" className="m-0 mb-1.5 text-[40px] font-medium tracking-[-0.01em]">
                    {kind} {number}
                </h1>
                <div className="mb-2 flex flex-wrap items-center justify-center gap-x-2.5 text-2xl">
                    <span className="size-4 rounded-full" style={{ background: color }} />
                    {lineName}
                    <span className="text-ink-3">|</span>
                    {v.builder ? `${v.builder} ${v.model ?? ''}` : 'Unknown builder'}
                </div>
                {specs.length > 0 && (
                    <p className="my-[3px] text-lg">
                        {specs.map((s, i) => (
                            <span key={s}>
                                {i > 0 && <Sep />}
                                {s}
                            </span>
                        ))}
                    </p>
                )}
                <p className="my-[3px] text-lg">
                    {built.map((s, i) => (
                        <span key={s}>
                            {i > 0 && <Sep />}
                            {s}
                        </span>
                    ))}
                </p>
            </div>

            <SeasonTable cars={cars} years={years} isBus={isBus} />

            <div className="grid gap-3.5 px-[18px] pt-3 pb-5 min-[761px]:grid-cols-[0.9fr_1.4fr]">
                <div>
                    <h3 className="mt-1.5 mb-2.5 text-2xl font-medium">{kind} Pages</h3>
                    <ul className="m-0 list-none p-0 text-lg">
                        <li>
                            <a
                                href="#tabs"
                                onClick={() => onTab('log')}
                                className="text-ink hover:text-brand block py-0.5 no-underline hover:underline"
                            >
                                Game Log
                            </a>
                        </li>
                        <li>
                            <Link
                                to="/glossary"
                                className="text-ink hover:text-brand block py-0.5 no-underline hover:underline"
                            >
                                Stat Glossary
                            </Link>
                        </li>
                        <li>
                            <a
                                href="#tabs"
                                onClick={() => onTab('mates')}
                                className="text-ink hover:text-brand block py-0.5 no-underline hover:underline"
                            >
                                {isBus ? 'Routes Run' : 'Coupled With'}
                            </a>
                        </li>
                        <li>
                            <Link
                                to="/line/$group"
                                params={{ group }}
                                className="text-ink hover:text-brand block py-0.5 no-underline hover:underline"
                            >
                                Line Leaderboard
                            </Link>
                        </li>
                    </ul>
                </div>
                <div className="min-w-0">
                    <h3 className="mt-1.5 mb-2.5 text-2xl font-medium">
                        <StatTerm id={isBus ? 'routes-run' : 'coupled-with'} align="left" />
                    </h3>
                    {isBus ? <RoutesMini car={car} /> : <MatesMini car={car} group={group} />}
                </div>
            </div>
        </section>
    );
}

function SeasonTable({
    cars,
    years,
    isBus,
}: {
    cars: Record<string, Car | null>;
    years: string[];
    isBus: boolean;
}) {
    if (!years.length) return null;
    const rows = years.map((k) => ({ k, c: cars[k]! }));
    const trips = rows.reduce((t, r) => t + r.c.trips, 0);
    const miles = rows.reduce((t, r) => t + (r.c.miles ?? 0), 0);
    const ih = Math.max(...rows.map((r) => r.c.iron_horse_days ?? 0));
    const th =
        'border-ink-2 border-b px-1 py-2 text-right font-bold whitespace-nowrap first:text-left';
    const td = 'px-1 py-[7px] text-right whitespace-nowrap first:text-left';
    return (
        <div className="mx-3.5 mt-[18px] mb-2 overflow-x-auto">
            <table className="w-full border-collapse text-[15px]">
                <thead>
                    <tr>
                        <th className={th}>Season</th>
                        <th className={th}>Trips</th>
                        {!isBus && <th className={th}>Miles</th>}
                        <th className={th}>Saved/stop</th>
                        <th className={th}>On-Sched</th>
                        <th className={`${th} leading-tight whitespace-normal!`}>Iron Horse</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(({ k, c }) => (
                        <tr key={k}>
                            <td className={td}>{k}</td>
                            <td className={td}>{c.trips.toLocaleString('en-US')}</td>
                            {!isBus && <td className={td}>{fmtNum(c.miles, 0)}</td>}
                            <td className={td}>{signed(timeSaved(c), 1, ' s')}</td>
                            <td className={td}>
                                {c.on_time_pct == null ? '–' : `${fmtNum(c.on_time_pct, 1)}%`}
                            </td>
                            <td className={td}>{c.iron_horse_days ?? '–'}</td>
                        </tr>
                    ))}
                    <tr className="bg-wash font-bold">
                        <td className={`${td} border-panel-line border-t`}>
                            {rows.length} Season{rows.length === 1 ? '' : 's'}
                        </td>
                        <td className={`${td} border-panel-line border-t`}>
                            {trips.toLocaleString('en-US')}
                        </td>
                        {!isBus && (
                            <td className={`${td} border-panel-line border-t`}>
                                {fmtNum(miles, 0)}
                            </td>
                        )}
                        <td className={`${td} border-panel-line border-t`} />
                        <td className={`${td} border-panel-line border-t`} />
                        <td className={`${td} border-panel-line border-t`}>{ih}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

/** A horizontal share bar that grows in from zero. */
export function ShareBar({ frac, color }: { frac: number; color: string }) {
    const grown = useGrowIn();
    return (
        <div
            className={`h-3.5 rounded-r-[7px] transition-[width] ${GROW}`}
            style={{
                width: grown ? `${Math.max(6, frac * 100)}%` : 0,
                background: `color-mix(in srgb, ${color} 70%, white)`,
            }}
        />
    );
}

export function CarPill({ group, number }: { group: GroupId; number: string }) {
    return (
        <Link
            to="/car/$group/$number"
            params={{ group, number }}
            className="inline-block min-w-[54px] rounded-full px-1.5 py-px text-center text-[15px] text-white no-underline hover:brightness-110"
            style={{ background: GROUPS[group].color }}
        >
            {number}
        </Link>
    );
}

function MatesMini({ car, group }: { car: Car; group: GroupId }) {
    const tm = car.teammates.slice(0, 6);
    if (!tm.length) return <p className="text-ink-3 m-0 text-base">No coupled cars recorded.</p>;
    const max = tm[0][1];
    return (
        <table className="w-full border-collapse text-[17px]">
            <thead>
                <tr>
                    <th className="px-1 pb-1.5 text-left text-base font-bold">Car</th>
                    <th className="px-1 pb-1.5 text-left text-base font-bold">Trips together</th>
                    <th className="px-1 pb-1.5 text-right text-base font-bold">Share</th>
                </tr>
            </thead>
            <tbody>
                {tm.map(([n, k]) => (
                    <tr key={n}>
                        <td className="px-1 py-[3px]">
                            <CarPill group={group} number={n} />
                        </td>
                        <td className="w-full px-1 py-[3px]">
                            <ShareBar frac={k / max} color={GROUPS[group].color} />
                        </td>
                        <td className="px-1 py-[3px] text-right">
                            {Math.round((k / car.trips) * 100)}%
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function RoutesMini({ car }: { car: Car }) {
    const routes = routeCounts(car).slice(0, 6);
    if (!routes.length) return <p className="text-ink-3 m-0 text-base">No routes recorded.</p>;
    const max = routes[0].days;
    const days = car.game_log.length;
    return (
        <table className="w-full border-collapse text-[17px]">
            <thead>
                <tr>
                    <th className="px-1 pb-1.5 text-left text-base font-bold">Route</th>
                    <th className="px-1 pb-1.5 text-left text-base font-bold">Days</th>
                    <th className="px-1 pb-1.5 text-right text-base font-bold">Share</th>
                </tr>
            </thead>
            <tbody>
                {routes.map((r) => (
                    <tr key={r.route}>
                        <td className="px-1 py-[3px]">
                            <span className="bg-line-bus text-ink inline-block min-w-[54px] rounded-full px-1.5 py-px text-center text-[15px] font-medium">
                                {r.route}
                            </span>
                        </td>
                        <td className="w-full px-1 py-[3px]">
                            <ShareBar frac={r.days / max} color={GROUPS.bus.color} />
                        </td>
                        <td className="px-1 py-[3px] text-right">
                            {Math.round((r.days / days) * 100)}%
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
