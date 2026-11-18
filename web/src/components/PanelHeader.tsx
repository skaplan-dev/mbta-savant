import type { ReactNode } from 'react';
import { seasonLabel } from '../seasons';

/** A car-page panel title led by its season, with optional extras (like a help button) beside it. */
export default function PanelHeader({
    id,
    season,
    title,
    children,
}: {
    id: string;
    season: string;
    title: string;
    children?: ReactNode;
}) {
    return (
        <div className="flex min-h-[3.75rem] items-center justify-center gap-3 px-[18px] pt-4 pb-2.5">
            <h2 id={id} className="text-subsection m-0 text-center font-medium">
                <span className="text-brand">{seasonLabel(season)}</span> {title}
            </h2>
            {children}
        </div>
    );
}
