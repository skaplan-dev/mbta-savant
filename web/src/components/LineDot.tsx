import { GROUPS, type GroupId } from '../groups';

/** A dot in the line's color; `className` sets its size and spacing. */
export default function LineDot({ group, className }: { group: GroupId; className: string }) {
    return (
        <span className={`rounded-full ${className}`} style={{ background: GROUPS[group].color }} />
    );
}
