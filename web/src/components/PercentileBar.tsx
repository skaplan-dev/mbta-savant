import { barPos, ordinal, pctColor } from '../format';
import { GROW, useGrowIn } from './useGrowIn';

const Track = () => <span className="bg-track absolute inset-x-0 top-1/2 -mt-1 h-2 rounded" />;

const Midline = () => (
    <span className="absolute inset-y-[3px] left-1/2 z-[2] w-0.5 -translate-x-1/2 bg-white/50" />
);

export default function PercentileBar({ pct, label }: { pct: number | null; label: string }) {
    const grown = useGrowIn();

    if (pct == null)
        return (
            <div
                role="img"
                aria-label={`${label}: not ranked`}
                className="relative mx-2 h-full min-h-[46px] opacity-45"
            >
                <Track />
            </div>
        );

    const color = pctColor(pct);

    return (
        <div
            role="img"
            aria-label={`${label}: ${ordinal(pct)} percentile`}
            className="relative mx-2 h-full min-h-[46px]"
        >
            <Track />
            <span
                className={`absolute inset-y-[3px] left-0 rounded-[3px] transition-[width] ${GROW}`}
                style={{
                    width: grown ? `${barPos(pct)}%` : 0,
                    background: `color-mix(in srgb, ${color} 72%, white)`,
                }}
            />
            <Midline />
            {/* The bubble stays fully inside the track at the extremes. */}
            <span
                className={`text-meta absolute top-1/2 z-[3] -mt-4 -ml-4 grid size-8 place-items-center rounded-full border-[2.5px] border-white font-bold text-white shadow-[0_1px_3px_rgb(0_0_0/0.25)] transition-[left] ${GROW}`}
                style={{
                    left: grown ? `${barPos(pct)}%` : '8%',
                    background: color,
                }}
            >
                {pct}
            </span>
        </div>
    );
}
