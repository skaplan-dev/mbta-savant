import { Link } from '@tanstack/react-router';
import { GROUPS, type GroupId } from '../format';
import { seasonParam } from '../search';

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
            // A number serializes as ?season=2026; validateSeasonSearch reads it back as a string.
            search={season ? { season: seasonParam(season) as string } : {}}
            className={`inline-block rounded-full text-center font-medium no-underline hover:brightness-110 ${SIZES[size]} ${group === 'bus' ? 'text-ink' : 'text-white'}`}
            style={{ background: GROUPS[group].color }}
        >
            {number}
        </Link>
    );
}
