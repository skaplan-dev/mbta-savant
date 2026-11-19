import { Link } from '@tanstack/react-router';
import { routeLabel } from '../busRoutes';
import { GROUPS, type GroupId } from '../groups';

const PILL = 'inline-block rounded-full text-center font-medium';

const SIZES = {
    md: 'min-w-[56px] px-3 py-0.5',
    sm: 'min-w-[54px] px-1.5 py-px text-meta',
} as const;

export default function CarPill({
    group,
    number,
    season,
    size = 'md',
}: {
    group: GroupId;
    number: string;
    season?: string;
    size?: keyof typeof SIZES;
}) {
    return (
        <Link
            to="/car/$group/$number"
            params={{ group, number }}
            search={{ season }}
            className={`${PILL} no-underline hover:brightness-110 ${SIZES[size]} ${GROUPS[group].onColor}`}
            style={{ background: GROUPS[group].color }}
        >
            {number}
        </Link>
    );
}

/** A bus route in a bus-yellow pill, linking to the route's leaderboard for `season`. */
export const RoutePill = ({ route, season }: { route: string; season?: string }) => (
    <Link
        to="/route/$route"
        params={{ route }}
        search={{ season }}
        className={`${PILL} bg-line-bus text-ink no-underline hover:brightness-105 ${SIZES.sm}`}
    >
        {routeLabel(route)}
    </Link>
);
