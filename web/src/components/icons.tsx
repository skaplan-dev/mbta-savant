// Section icons, drawn in the current text color.

const stroke = { stroke: 'currentColor', strokeWidth: 3.5 } as const;

/** `detailed` adds the stopwatch's side button. */
export function StopwatchIcon({
    className,
    detailed = false,
}: {
    className: string;
    detailed?: boolean;
}) {
    return (
        <svg viewBox="0 0 40 40" aria-hidden="true" className={className}>
            <circle cx="20" cy="23" r="13" fill="none" {...stroke} />
            <path d="M20 23 L20 14" strokeLinecap="round" {...stroke} />
            <rect x="16" y="4" width="8" height="5" fill="currentColor" />
            {detailed && <path d="M31 11 l3-3" strokeLinecap="round" {...stroke} />}
        </svg>
    );
}

/** `detailed` adds a check mark. */
export function CalendarIcon({
    className,
    detailed = false,
}: {
    className: string;
    detailed?: boolean;
}) {
    return (
        <svg viewBox="0 0 40 40" aria-hidden="true" className={className}>
            <rect x="5" y="8" width="30" height="27" rx="2" fill="none" {...stroke} />
            <path d="M5 16 H35" {...stroke} />
            <path d="M12 4 V11 M28 4 V11" strokeLinecap="round" {...stroke} />
            {detailed && (
                <path
                    d="M12 24 l5 5 l10 -10"
                    stroke="var(--color-great)"
                    strokeWidth="3.5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            )}
        </svg>
    );
}
