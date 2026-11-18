import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import type { ReactNode } from 'react';

/** A button that opens `children` in a small dark panel above it (below when there's no room). */
export default function InfoPopover({
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
    return (
        <Popover className={`inline-block ${className}`}>
            <PopoverButton aria-label={triggerLabel} className={triggerClass}>
                {trigger}
            </PopoverButton>
            <PopoverPanel
                anchor={{ to: 'top', gap: 8, padding: 8 }}
                transition
                className="bg-ink text-meta z-10 w-[260px] max-w-[80vw] rounded-md px-3 py-2.5 text-left leading-[1.35] font-normal whitespace-normal text-white shadow-[0_6px_20px_rgb(0_0_0/0.2)] transition duration-150 ease-out data-closed:translate-y-1 data-closed:opacity-0 motion-reduce:transition-none"
            >
                {children}
            </PopoverPanel>
        </Popover>
    );
}
