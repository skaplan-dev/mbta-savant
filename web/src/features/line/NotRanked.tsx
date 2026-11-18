import CarPill from '../../components/CarPill';
import SectionHeading from '../../components/SectionHeading';
import { fmtInt } from '../../format';
import type { GroupId } from '../../groups';
import type { UnrankedCar } from './leaderboard';

export default function NotRanked({
    group,
    season,
    rows,
}: {
    group: GroupId;
    season: string;
    rows: UnrankedCar[];
}) {
    return (
        <section className="mt-10" aria-label="Not ranked">
            <SectionHeading className="m-0 mb-1">Not ranked</SectionHeading>
            <p className="text-ink-2 text-ui mt-2 mb-3">
                These cars have trips this season but no percentile ranking.
            </p>
            <ul className="m-0 grid list-none grid-cols-1 gap-x-8 p-0 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map(({ car, reason }) => (
                    <li
                        key={car.car_id}
                        className="border-row-rule flex items-center gap-3 border-b border-dashed py-2"
                    >
                        <CarPill group={group} number={car.number} season={season} />
                        <span className="text-ink-2 text-ui">
                            {fmtInt(car.trips)} trips · {reason}
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}
