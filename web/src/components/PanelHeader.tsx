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
        <div className="flex items-center justify-center gap-3 px-[18px] pt-4 pb-2.5">
            <h2 id={id} className="m-0 text-center text-[27px] font-medium">
                <span className="border-brand-2 border-b-[3px] border-dotted pb-0.5">
                    {seasonLabel(season)}
                </span>{' '}
                {title}
            </h2>
            {children}
        </div>
    );
}
