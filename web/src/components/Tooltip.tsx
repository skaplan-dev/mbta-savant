import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

// Panels clip their overflow, so a tooltip has to fit inside the panel it's in.
const BOUNDARY = '.panel';
const GAP = 8;
const EDGE = 8;

interface Placement {
    /** Tip's left edge, relative to the trigger. */
    left: number;
    below: boolean;
}

/** Centered on the trigger, kept inside the boundary and viewport, and below when there's no room above. */
function place(anchor: HTMLElement, tip: HTMLElement): Placement {
    const a = anchor.getBoundingClientRect();
    const box = anchor.closest(BOUNDARY)?.getBoundingClientRect();
    const lo = Math.max(box?.left ?? 0, 0) + EDGE;
    const hi = Math.min(box?.right ?? Infinity, window.innerWidth) - EDGE;
    const centered = a.left + a.width / 2 - tip.offsetWidth / 2;
    const left = Math.max(lo, Math.min(centered, hi - tip.offsetWidth));
    const roomAbove = a.top - Math.max(box?.top ?? 0, 0);

    return { left: left - a.left, below: roomAbove < tip.offsetHeight + GAP };
}

/**
 * A button that shows `children` in a tooltip on hover or focus. Esc dismisses it however it was
 * opened (WCAG 1.4.13); it reopens on the next hover or focus.
 */
export default function Tooltip({
    trigger,
    triggerClass,
    triggerLabel,
    className = '',
    children,
}: {
    trigger: ReactNode;
    triggerClass: string;
    triggerLabel?: string;
    className?: string;
    children: ReactNode;
}) {
    const tipId = useId();
    const root = useRef<HTMLSpanElement>(null);
    const tip = useRef<HTMLSpanElement>(null);
    const [open, setOpen] = useState(false);
    const [placement, setPlacement] = useState<Placement>({ left: 0, below: false });

    useLayoutEffect(() => {
        if (open && root.current && tip.current) setPlacement(place(root.current, tip.current));
    }, [open]);

    useEffect(() => {
        if (!open) return;

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };

        document.addEventListener('keydown', onKey);

        return () => document.removeEventListener('keydown', onKey);
    }, [open]);

    // Hover and focus each keep it open; it closes once neither holds.
    const focused = () => !!root.current?.contains(document.activeElement);
    const hovered = () => !!root.current?.matches(':hover');

    return (
        <span
            ref={root}
            className={`relative inline-block ${className}`}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => !focused() && setOpen(false)}
            onFocus={() => setOpen(true)}
            onBlur={(e) => {
                const inside =
                    e.relatedTarget instanceof Node && root.current?.contains(e.relatedTarget);

                if (!inside && !hovered()) setOpen(false);
            }}
        >
            <button
                type="button"
                aria-describedby={tipId}
                aria-label={triggerLabel}
                className={triggerClass}
            >
                {trigger}
            </button>
            <span
                id={tipId}
                ref={tip}
                role="tooltip"
                style={{ left: placement.left }}
                // The ::before strip bridges the 8px gap so moving onto a link inside doesn't close it.
                className={`bg-ink absolute before:absolute before:inset-x-0 before:h-2 before:content-[''] ${placement.below ? 'top-[calc(100%+8px)] before:bottom-full' : 'bottom-[calc(100%+8px)] before:top-full'} z-10 w-[260px] max-w-[80vw] rounded-md px-3 py-2.5 text-left text-[15px] leading-[1.35] font-normal whitespace-normal text-white shadow-[0_6px_20px_rgb(0_0_0/0.2)] transition-[opacity,translate] duration-150 ease-out motion-reduce:transition-none ${
                    open ? 'visible translate-y-0 opacity-100' : 'invisible translate-y-1 opacity-0'
                }`}
            >
                {children}
            </span>
        </span>
    );
}
