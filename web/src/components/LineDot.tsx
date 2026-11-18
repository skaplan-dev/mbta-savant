import { GROUPS, type GroupId } from '../groups';

export default function LineDot({ group, className }: { group: GroupId; className: string }) {
    return (
        <span className={`rounded-full ${className}`} style={{ background: GROUPS[group].color }} />
    );
}
