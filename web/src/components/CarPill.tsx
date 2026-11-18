import { Link } from '@tanstack/react-router';
import { GROUPS, type GroupId } from '../groups';

const PILL = 'inline-block rounded-full text-center font-medium';

const SIZES = {
    md: 'min-w-[56px] px-3 py-0.5',
    sm: 'min-w-[54px] px-1.5 py-px text-[15px]',
} as const;

/** A car number in its line's color, linking to the car page (optionally pinned to a season). */
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

/** A bus route name in a bus-yellow pill (not a link). */
export const RoutePill = ({ route }: { route: string }) => (
    <span className={`${PILL} bg-line-bus text-ink ${SIZES.sm}`}>{route}</span>
);
