import { Link } from '@tanstack/react-router';
import { GLOSSARY, type StatId } from '../glossary';
import Tooltip from './Tooltip';

const TERM =
    'hover:text-brand focus-visible:text-brand decoration-brand-2 cursor-help border-0 bg-transparent p-0 text-inherit underline decoration-dotted decoration-[1.5px] underline-offset-4 [font:inherit]';

/** A stat name with a dotted underline; its tooltip has the glossary's short definition and a link. */
export default function StatTerm({ id }: { id: StatId }) {
    const entry = GLOSSARY[id];

    return (
        <Tooltip trigger={entry.name} triggerClass={TERM}>
            {entry.short}{' '}
            <Link to="/glossary" hash={id} className="text-tip-link underline">
                More
            </Link>
        </Tooltip>
    );
}
