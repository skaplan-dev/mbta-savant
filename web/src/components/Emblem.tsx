// A subway car seen head-on, coming down the track: windshield, headlights, and rails running to the horizon.
export default function Emblem({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 80 80" aria-hidden="true" className={className}>
            <path
                d="M20 8h40a8 8 0 0 1 8 8v36a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6V16a8 8 0 0 1 8-8z"
                fill="var(--color-brand)"
            />
            <rect x="19" y="15" width="42" height="22" rx="4" fill="#fff" />
            <path d="M40 15v22" stroke="var(--color-brand)" strokeWidth="3" />
            <rect x="12" y="41" width="56" height="4" fill="var(--color-brand-2)" />
            <circle cx="22" cy="50" r="3.5" fill="var(--color-great)" />
            <circle cx="58" cy="50" r="3.5" fill="var(--color-great)" />
            <g stroke="var(--color-brand)" strokeWidth="3" strokeLinecap="round" fill="none">
                <path d="M26 62l-8 14M54 62l8 14" />
                <path d="M24 68h32M21 73h38" strokeWidth="2" />
            </g>
        </svg>
    );
}
