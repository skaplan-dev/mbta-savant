import type { ReactNode } from 'react';

/** A bold section title over a brand rule; `className` sets size and margins. */
export default function SectionHeading({
    id,
    className,
    children,
}: {
    id?: string;
    className: string;
    children: ReactNode;
}) {
    return (
        <h2 id={id} className={`border-brand-2 border-b pb-2 font-bold ${className}`}>
            {children}
        </h2>
    );
}
