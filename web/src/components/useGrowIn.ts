import { useEffect, useState } from 'react';

/**
 * False on the first paint, true one frame later, so CSS transitions grow bars from zero once on
 * mount. Reduced motion is handled in CSS (`motion-reduce:transition-none`).
 */
export function useGrowIn(): boolean {
    const [on, setOn] = useState(false);
    useEffect(() => {
        let inner = 0;

        const outer = requestAnimationFrame(() => {
            inner = requestAnimationFrame(() => setOn(true));
        });

        return () => {
            cancelAnimationFrame(outer);
            cancelAnimationFrame(inner);
        };
    }, []);

    return on;
}

export const GROW =
    'duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none';
