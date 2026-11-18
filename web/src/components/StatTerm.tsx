import { Link } from '@tanstack/react-router';
import { useId, useRef, useState, type ReactNode } from 'react';
import { GLOSSARY, type StatId } from '../glossary';

type Align = 'right' | 'left' | 'center';

const tipAlign: Record<Align, string> = {
    right: 'right-0',
    left: 'left-0',
    center: 'left-1/2 -translate-x-1/2',
};

/**
 * A stat name with a dotted underline. Hover or focus shows the glossary's short definition and a
 * "More" link to /glossary#<id>; Esc dismisses it.
 */
export default function StatTerm({
    id,
    children,
    align = 'right',
}: {
    id: StatId;
    children?: ReactNode;
    align?: Align;
}) {
    const tipId = useId();
    const [hover, setHover] = useState(false);
    const [focus, setFocus] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const wrap = useRef<HTMLSpanElement>(null);
    const open = (hover || focus) && !dismissed;
    const entry = GLOSSARY[id];

    return (
        <span
            ref={wrap}
            className="relative inline-block"
            onMouseEnter={() => {
                setHover(true);
                setDismissed(false);
            }}
            onMouseLeave={() => setHover(false)}
            onFocus={() => {
                setFocus(true);
                setDismissed(false);
            }}
            onBlur={(e) => {
                if (!wrap.current?.contains(e.relatedTarget as Node | null)) setFocus(false);
            }}
            onKeyDown={(e) => {
                if (e.key === 'Escape' && open) {
                    e.stopPropagation();
                    setDismissed(true);
                }
            }}
        >
            <button
                type="button"
                aria-describedby={tipId}
                className="hover:text-brand focus-visible:text-brand decoration-brand-2 cursor-help border-0 bg-transparent p-0 text-inherit underline decoration-dotted decoration-[1.5px] underline-offset-4 [font:inherit]"
            >
                {children ?? entry.name}
            </button>
            <span
                id={tipId}
                role="tooltip"
                className={`bg-ink absolute bottom-[calc(100%+8px)] z-10 w-[260px] max-w-[80vw] rounded-md px-3 py-2.5 text-left text-[15px] leading-[1.35] font-normal whitespace-normal text-white shadow-[0_6px_20px_rgb(0_0_0/0.2)] transition-[opacity,translate] duration-150 ease-out motion-reduce:transition-none ${tipAlign[align]} ${
                    open ? 'visible translate-y-0 opacity-100' : 'invisible translate-y-1 opacity-0'
                }`}
            >
                {entry.short}{' '}
                <Link to="/glossary" hash={id} className="text-[#9fd3de] underline">
                    More
                </Link>
            </span>
        </span>
    );
}
