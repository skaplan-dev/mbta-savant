import { Link } from '@tanstack/react-router';
import type { Car, GroupSummary } from '../../api';
import PercentileBar from '../../components/PercentileBar';
import StatTerm from '../../components/StatTerm';
import { dwellSaved, fmtNum, fmtTrips, timeSaved } from '../../format';

const COLS = 'grid grid-cols-[32%_minmax(0,1fr)_72px]';

type Parts = NonNullable<Car['tar_parts']>;

/** Everything the math block needs; null when this data file predates TAR's inputs. */
function mathInputs(car: Car, summary: GroupSummary | null | undefined) {
    const repl = summary?.tar_replacement;
    const { trips_per_day: tpd, trip_len_sec: len, segs_per_trip: segs } = summary ?? {};
    const travel = timeSaved(car);
    const fast = travel == null ? null : travel + (dwellSaved(car) ?? 0);

    if (
        !car.tar_parts ||
        car.eligible_days == null ||
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
}: {
    m: NonNullable<ReturnType<typeof mathInputs>>;
    car: Car;
    tar: number;
}) {
    const share = m.service / m.eligible;
    const steady = car.steady_adj_sec;
    const canSteady = steady != null && m.replSteady != null && m.segs != null;

    return (
        <details className="text-ui text-ink-2 mt-3">
            <summary className="text-brand cursor-pointer">Show the math</summary>
            <ul className="mt-2 mb-0 list-none space-y-2 p-0">
                <li>
                    <b className="text-ink font-medium">On the field:</b> (service share{' '}
                    {fmtNum(share, 3)} − replacement {fmtNum(m.replShare, 3)}) ×{' '}
                    {fmtNum(m.eligible, 0)} eligible days ({fmtNum(m.service, 0)} in service) ×{' '}
                    {fmtNum(m.tpd, 1)} trips per day = {fmtTrips(m.parts.field)}
                </li>
                <li>
                    <b className="text-ink font-medium">Speed:</b> ({fmtNum(m.fast, 1)} s faster per
                    trip − replacement {fmtNum(m.replFast, 1)} s) × {fmtNum(m.trips, 0)} trips ÷{' '}
                    {fmtNum(m.len, 0)} s typical trip length = {fmtTrips(m.parts.speed)}
                </li>
                <li>
                    <b className="text-ink font-medium">Steadiness:</b>{' '}
                    {canSteady ? (
                        <>
                            ({fmtNum(steady, 1)} s − replacement {fmtNum(m.replSteady, 1)} s) ×{' '}
                            {fmtNum(m.segs, 1)} segments per trip × {fmtNum(m.trips, 0)} trips ÷{' '}
                            {fmtNum(m.len, 0)} s typical trip length = {fmtTrips(m.parts.steady)}
                        </>
                    ) : (
                        'not measured for this car, so it adds nothing'
                    )}
                </li>
                <li>
                    <b className="text-ink font-medium">Total:</b> {fmtTrips(m.parts.field)}{' '}
                    {fmtTrips(m.parts.speed)} {fmtTrips(m.parts.steady)} = {fmtTrips(tar)} TAR. Each
                    part is rounded separately, so the total may differ from their sum by a trip.
                </li>
            </ul>
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
    const part = (label: string, v: number | undefined, measured = true) =>
        parts && measured ? `${label} ${fmtTrips(v)}` : `${label} not measured`;

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
                    <p className="text-ink m-0 mt-1 text-center font-medium">
                        {fmtTrips(tar)} trips above replacement
                    </p>
                    {parts && (
                        <p className="text-meta text-ink-2 m-0 mt-1 flex flex-wrap justify-center gap-x-3 text-center">
                            <span>{part('On the field', parts.field)}</span>
                            <span>{part('Speed', parts.speed)}</span>
                            <span>
                                {part('Steadiness', parts.steady, car.steady_adj_sec != null)}
                            </span>
                        </p>
                    )}
                    {m && <TarMath m={m} car={car} tar={tar} />}
                </>
            )}
        </div>
    );
}
