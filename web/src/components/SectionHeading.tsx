import type { ReactNode } from 'react';

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
        <h2
            id={id}
            className={`border-brand-2 text-section border-b pb-2 font-medium ${className}`}
        >
            {children}
        </h2>
    );
}
