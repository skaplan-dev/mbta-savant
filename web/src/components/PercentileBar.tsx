import { ordinal, pctColor } from '../format';
import { GROW, useGrowIn } from './useGrowIn';

/**
 * Savant-style percentile bar: a thin track with a midline, a tinted fill and a saturated bubble.
 * With `pct` null it draws only the faded track (unranked).
 */
export default function PercentileBar({ pct, label }: { pct: number | null; label: string }) {
    const grown = useGrowIn();
    const p = pct ?? 0;
    const color = pctColor(p);

    return (
        <div
            role="img"
            aria-label={`${label}: ${pct == null ? 'not ranked' : `${ordinal(pct)} percentile`}`}
            className={`relative mx-1 h-[26px] ${pct == null ? 'opacity-45' : ''}`}
        >
            <span className="bg-track absolute inset-x-0 top-1/2 -mt-1 h-2 rounded" />
            <span className="absolute top-[3px] bottom-[3px] left-1/2 z-[2] w-px bg-[rgb(29_36_39/0.18)]" />
            {pct != null && (
                <>
                    <span
                        className={`absolute top-1/2 left-0 -mt-[9px] h-[18px] rounded-[9px] transition-[width] ${GROW}`}
                        style={{
                            width: grown ? `${p}%` : 0,
                            background: `color-mix(in srgb, ${color} 45%, white)`,
                        }}
                    />
                    <span
                        className={`absolute top-1/2 z-[3] -mt-4 -ml-4 grid size-8 place-items-center rounded-full border-[2.5px] border-white text-[15px] font-bold text-white shadow-[0_1px_3px_rgb(0_0_0/0.25)] transition-[left] ${GROW}`}
                        style={{
                            left: grown ? `${Math.max(4, Math.min(96, p))}%` : '4%',
                            background: color,
                        }}
                    >
                        {pct}
                    </span>
                </>
            )}
        </div>
    );
}
