import type { Car, GroupSummary } from '../../api';
import PercentileBar from '../../components/PercentileBar';
import StatTerm from '../../components/StatTerm';
import { COLS } from './shared';
import { fmtNum, fmtTrips } from '../../format';

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

export default function TarBlock({
    car,
    summary,
}: {
    car: Car;
    summary: GroupSummary | null | undefined;
}) {
    const tar = car.tar ?? null;
    const parts: Parts | null = car.tar_parts ?? null;
    const measured = steadyMeasured(car, summary);
    const part = (label: string, v: number | undefined, ok = true) =>
        parts && ok ? `${label} ${fmtTrips(v)}` : `${label} not measured`;

    return (
        <div className="pb-2.5">
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
                </>
            )}
        </div>
    );
}
