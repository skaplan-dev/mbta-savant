import { Link } from '@tanstack/react-router';
import { GROUPS, type GroupId } from '../format';

/** A car number in its line's color, linking to the car page. */
export default function CarPill({
    group,
    number,
    season,
}: {
    group: GroupId;
    number: string;
    season?: string;
}) {
    return (
        <Link
            to="/car/$group/$number"
            params={{ group, number }}
            search={season ? { season } : {}}
            className={`inline-block min-w-[56px] rounded-full px-3 py-0.5 text-center font-medium no-underline hover:brightness-110 ${group === 'bus' ? 'text-ink' : 'text-white'}`}
            style={{ background: GROUPS[group].color }}
        >
            {number}
        </Link>
    );
}

/** Value-cell tint from a percentile; the same blue-gray-red scale, lightened. */
export const tint = (color: string) => `color-mix(in srgb, ${color} 35%, white)`;
