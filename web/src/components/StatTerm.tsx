import { Link } from '@tanstack/react-router';
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { GLOSSARY, type StatId } from '../glossary';

type Align = 'right' | 'left' | 'center';

const tipAlign: Record<Align, string> = {
    right: 'right-0',
    left: 'left-0',
    center: 'left-1/2 -translate-x-1/2',
};

/**
 * A stat name with a dotted underline. Hover or focus shows the glossary's short definition and a
 * "More" link to /glossary#<id>; Esc dismisses it (however it was opened). On open the tooltip is
 * shifted sideways so it stays inside its panel and the viewport.
 */
export default function StatTerm({
    id,
    children,
    align = 'right',
    below = false,
}: {
    id: StatId;
    children?: ReactNode;
    align?: Align;
    /** Open under the term (for table headers inside scroll containers). */
    below?: boolean;
}) {
    const tipId = useId();
    const [hover, setHover] = useState(false);
    const [focus, setFocus] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const wrap = useRef<HTMLSpanElement>(null);
    const tip = useRef<HTMLSpanElement>(null);
    const [shift, setShift] = useState(0);
    const open = (hover || focus) && !dismissed;
    const entry = GLOSSARY[id];

    // Keep the tooltip inside the nearest panel (which clips overflow) and the viewport.
    useLayoutEffect(() => {
        if (!open || !tip.current) return;
        const r = tip.current.getBoundingClientRect();
        const natural = r.left - shift;
        const clip = wrap.current?.closest('.panel')?.getBoundingClientRect();
        const lo = Math.max(8, (clip?.left ?? 0) + 8);
        const hi = Math.min(window.innerWidth, clip?.right ?? Infinity) - 8;
        const next =
            natural < lo
                ? lo - natural
                : natural + r.width > hi
                  ? Math.max(lo - natural, hi - natural - r.width)
                  : 0;
        if (next !== shift) setShift(next);
    }, [open, shift]);

    // Esc dismisses even a hover-only tooltip (WCAG 1.4.13).
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setDismissed(true);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open]);

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
                ref={tip}
                role="tooltip"
                style={{ transform: shift ? `translateX(${shift}px)` : undefined }}
                // The ::before strip bridges the 8px gap so moving onto "More" doesn't close it.
                className={`bg-ink absolute before:absolute before:inset-x-0 before:h-2 before:content-[''] ${below ? 'top-[calc(100%+8px)] before:bottom-full' : 'bottom-[calc(100%+8px)] before:top-full'} z-10 w-[260px] max-w-[80vw] rounded-md px-3 py-2.5 text-left text-[15px] leading-[1.35] font-normal whitespace-normal text-white shadow-[0_6px_20px_rgb(0_0_0/0.2)] transition-[opacity,translate] duration-150 ease-out motion-reduce:transition-none ${tipAlign[align]} ${
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
