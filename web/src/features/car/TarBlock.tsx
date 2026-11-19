import { Link } from '@tanstack/react-router';
import type { Car, GroupSummary } from '../../api';
import PercentileBar from '../../components/PercentileBar';
import StatTerm from '../../components/StatTerm';
import { COLS } from './shared';
import { dwellSaved, fmtNum, fmtTrips, signed, timeSaved } from '../../format';

type Parts = NonNullable<Car['tar_parts']>;

/** Steadiness is measured only when the car, the replacement level and segments per trip are all present. */
function steadyMeasured(car: Car, summary: GroupSummary | null | undefined): boolean {
    return (
        car.steady_adj_sec != null &&
        summary?.tar_replacement?.steady_adj_sec != null &&
        summary.segs_per_trip != null
    );
}

function headline(tar: number): string {
    if (Math.round(tar) === 0) return 'at replacement level';

    return tar < 0
        ? `${fmtNum(Math.abs(tar), 0)} trips below replacement`
        : `${fmtTrips(tar)} trips above replacement`;
}

/** Everything the math block needs; null when this data file predates TAR's inputs. */
function mathInputs(car: Car, summary: GroupSummary | null | undefined) {
    const repl = summary?.tar_replacement;
    const { trips_per_day: tpd, trip_len_sec: len, segs_per_trip: segs } = summary ?? {};
    const travel = timeSaved(car);
    const fast = travel == null ? null : travel + (dwellSaved(car) ?? 0);

    if (
        !car.tar_parts ||
        car.service_days == null ||
        !car.eligible_days ||
        fast == null ||
        !repl ||
        repl.service_share == null ||
        repl.fast_sec == null ||
        tpd == null ||
        !len
    )
        return null;

    return {
        parts: car.tar_parts,
        eligible: car.eligible_days,
        service: car.service_days,
        fast,
        trips: car.trips,
        tpd,
        len,
        segs,
        replShare: repl.service_share,
        replFast: repl.fast_sec,
        replSteady: repl.steady_adj_sec,
    };
}

function TarMath({
    m,
    car,
    tar,
    canSteady,
}: {
    m: NonNullable<ReturnType<typeof mathInputs>>;
    car: Car;
    tar: number;
    canSteady: boolean;
}) {
    const share = m.service / m.eligible;
    const steady = car.steady_adj_sec;

    const lenMin = fmtNum(m.len / 60, 1);
    const sec = (v: number | null | undefined) => `${signed(v, 1)} s`;
    const { field, speed, steady: st } = m.parts;
    // Explicit operators so a reader can add the parts by hand; an unmeasured part counts as 0.
    const join = (vals: number[]) =>
        vals
            .map((v, i) =>
                i === 0 ? fmtTrips(v) : `${Math.round(v) < 0 ? '−' : '+'} ${fmtNum(Math.abs(v), 0)}`
            )
            .join(' ');
    const stTerm = canSteady ? st : 0;
    const totalText = canSteady
        ? join([field, speed, stTerm])
        : `${join([field, speed])} + 0 (not measured)`;

    return (
        <details className="text-ui text-ink-2 mt-3">
            <summary className="text-brand focus-visible:outline-brand cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2">
                Show the math
            </summary>
            <ul className="mt-2 mb-0 list-none space-y-2 p-0">
                <li>
                    <b className="text-ink font-medium">On the field:</b> (service share{' '}
                    {fmtNum(m.service, 0)} of {fmtNum(m.eligible, 0)} eligible days ={' '}
                    {fmtNum(share, 4)} − replacement {fmtNum(m.replShare, 4)}) ×{' '}
                    {fmtNum(m.eligible, 0)} eligible days × {fmtNum(m.tpd, 2)} trips per day ={' '}
                    {fmtTrips(field)}
                </li>
                <li>
                    <b className="text-ink font-medium">Speed:</b> ({sec(m.fast)} saved per trip −
                    replacement {sec(m.replFast)}) × {fmtNum(m.trips, 0)} trips ÷ {fmtNum(m.len, 0)}{' '}
                    s ({lenMin} min) typical trip length = {fmtTrips(speed)}
                </li>
                <li>
                    <b className="text-ink font-medium">Steadiness:</b>{' '}
                    {canSteady ? (
                        <>
                            ({sec(steady)} − replacement {sec(m.replSteady)}) × {fmtNum(m.segs, 1)}{' '}
                            segments per trip × {fmtNum(m.trips, 0)} trips ÷ {fmtNum(m.len, 0)} s (
                            {lenMin} min) typical trip length = {fmtTrips(st)}
                        </>
                    ) : (
                        'not measured'
                    )}
                </li>
                <li>
                    <b className="text-ink font-medium">Total:</b> {totalText} = {fmtTrips(tar)}{' '}
                    trips
                </li>
            </ul>
            <p className="text-ink-3 text-meta mt-2 mb-0">
                Figures are rounded for display; parts may differ by a trip.
            </p>
            <Link to="/glossary" hash="tar-calc" className="text-brand mt-2 block underline">
                How TAR is calculated
            </Link>
        </details>
    );
}

export default function TarBlock({
    car,
    summary,
}: {
    car: Car;
    summary: GroupSummary | null | undefined;
}) {
    const tar = car.tar ?? null;
    const parts: Parts | null = car.tar_parts ?? null;
    const m = tar == null ? null : mathInputs(car, summary);
    const measured = steadyMeasured(car, summary);
    const part = (label: string, v: number | undefined, ok = true) =>
        parts && ok ? `${label} ${fmtTrips(v)}` : `${label} not measured`;

    return (
        <div className="mt-2.5">
            <div className={`${COLS} items-stretch`}>
                <div className="text-meta text-ink-2 flex items-center justify-end pr-2.5 text-right leading-tight">
                    <StatTerm id="tar" />
                </div>
                <PercentileBar pct={tar == null ? null : (car.pct.tar ?? null)} label="TAR" />
                <div className="text-meta text-ink flex items-center justify-end text-right leading-tight font-medium">
                    {fmtTrips(tar)}
                </div>
            </div>
            {tar != null && (
                <>
                    <p className="text-ink m-0 mt-1 text-center font-medium">{headline(tar)}</p>
                    {parts && (
                        <p className="text-meta text-ink-2 m-0 mt-1 flex flex-wrap justify-center gap-x-3 text-center">
                            <span>{part('On the field', parts.field)}</span>
                            <span>{part('Speed', parts.speed)}</span>
                            <span>{part('Steadiness', parts.steady, measured)}</span>
                        </p>
                    )}
                    {m && <TarMath m={m} car={car} tar={tar} canSteady={measured} />}
                </>
            )}
        </div>
    );
}
