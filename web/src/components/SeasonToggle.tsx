import { Link, useNavigate } from '@tanstack/react-router';
import { CAREER, isYearKey, LAST30, seasonLabel } from '../seasons';

const segment =
    'border-panel-line text-ui sm:text-lead flex flex-1 items-center justify-center border-r px-2 py-2.5 whitespace-nowrap no-underline last:border-r-0 sm:flex-none sm:px-[22px] sm:py-0';
const activeCls = 'bg-brand text-white';
const idleCls = 'text-ink hover:bg-wash bg-white';

function SeasonLink({ k, on }: { k: string; on: boolean }) {
    return (
        <Link
            to="."
            search={(prev) => ({ ...prev, season: k })}
            aria-current={on ? 'page' : undefined}
            className={`${segment} ${on ? activeCls : idleCls}`}
        >
            {seasonLabel(k)}
        </Link>
    );
}

export default function SeasonToggle({ options, value }: { options: string[]; value: string }) {
    const navigate = useNavigate();
    const years = options.filter(isYearKey);
    const frame = 'border-panel-line rounded-panel flex overflow-hidden border';

    if (options.length <= 3) {
        return (
            <nav aria-label="Season" className={frame}>
                {options.map((k) => (
                    <SeasonLink key={k} k={k} on={k === value} />
                ))}
            </nav>
        );
    }

    const yearOn = isYearKey(value);

    return (
        <nav aria-label="Season" className={frame}>
            {options.includes(CAREER) && <SeasonLink k={CAREER} on={value === CAREER} />}
            <select
                aria-label="Year"
                value={yearOn ? value : ''}
                onChange={(e) => {
                    const season = e.target.value;

                    if (isYearKey(season))
                        void navigate({ to: '.', search: (prev) => ({ ...prev, season }) });
                }}
                className={`${segment} min-w-0 cursor-pointer appearance-auto text-center ${yearOn ? activeCls : idleCls}`}
            >
                {!yearOn && (
                    <option value="" disabled>
                        Year
                    </option>
                )}
                {years.map((y) => (
                    <option key={y} value={y} className="text-ink bg-white">
                        {y}
                    </option>
                ))}
            </select>
            {options.includes(LAST30) && <SeasonLink k={LAST30} on={value === LAST30} />}
        </nav>
    );
}
