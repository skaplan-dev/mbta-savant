import type { Car } from '../../api';
import CarPill, { RoutePill } from '../../components/CarPill';
import ShareTable, { type ShareRow } from '../../components/ShareTable';
import { GROUPS, type GroupId } from '../../groups';
import { routeCounts } from './shared';

/**
 * Rail: the cars this one ran coupled to, by shared trips. Bus: the routes it ran, by days. The
 * compact form (bio panel) shows the top six.
 */
export default function PartnerTable({
    car,
    group,
    season,
    compact = false,
}: {
    car: Car;
    group: GroupId;
    season: string;
    compact?: boolean;
}) {
    const rail = GROUPS[group].mode === 'rail';

    const rows: ShareRow[] = rail
        ? car.teammates.map(([n, k]) => ({
              key: n,
              label: (
                  <CarPill group={group} number={n} season={season} size={compact ? 'sm' : 'md'} />
              ),
              count: k,
          }))
        : routeCounts(car).map((r) => ({
              key: r.route,
              label: <RoutePill route={r.route} season={season} />,
              count: r.days,
          }));

    if (!rows.length)
        return (
            <p className={compact ? 'text-ink-3 text-ui m-0' : 'text-ink-2 text-ui text-center'}>
                {rail ? 'No coupled cars recorded.' : 'No routes recorded.'}
            </p>
        );

    return (
        <ShareTable
            rows={compact ? rows.slice(0, 6) : rows}
            total={rail ? car.trips : car.game_log.length}
            color={GROUPS[group].color}
            headers={
                rail
                    ? ['Car', 'Trips together', 'Trips']
                    : ['Route', compact ? 'Days' : 'Days on route', 'Days']
            }
            compact={compact}
        />
    );
}
