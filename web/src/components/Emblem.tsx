// A wheel seen side-on; the rim is stitched like a seam.
export default function Emblem({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 80 80" aria-hidden="true" className={className}>
            <circle
                cx="40"
                cy="40"
                r="35"
                fill="none"
                stroke="var(--color-brand)"
                strokeWidth="5"
            />
            <circle
                cx="40"
                cy="40"
                r="25"
                fill="none"
                stroke="var(--color-brand-2)"
                strokeWidth="2"
                strokeDasharray="3 4"
            />
            <circle cx="40" cy="40" r="7" fill="var(--color-brand)" />
            <g stroke="var(--color-brand)" strokeWidth="3" strokeLinecap="round">
                <line x1="40" y1="33" x2="40" y2="18" />
                <line x1="40" y1="47" x2="40" y2="62" />
                <line x1="33" y1="40" x2="18" y2="40" />
                <line x1="47" y1="40" x2="62" y2="40" />
            </g>
            <path
                d="M14 28 q4 -5 9 -8"
                stroke="var(--color-great)"
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
            />
            <path
                d="M66 52 q-4 5 -9 8"
                stroke="var(--color-great)"
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
            />
        </svg>
    );
}
