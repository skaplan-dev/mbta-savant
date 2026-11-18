import { Link } from '@tanstack/react-router';
import { seasonLabel } from '../format';
import { seasonParam } from '../search';

/** Segmented season control; each option is a link that sets `?season=`. */
export default function SeasonToggle({ options, value }: { options: string[]; value: string }) {
    return (
        <nav
            aria-label="Season"
            className="border-panel-line rounded-panel flex overflow-hidden border"
        >
            {options.map((k) => {
                const on = k === value;

                return (
                    <Link
                        key={k}
                        to="."
                        // A number serializes as ?season=2026; validateSeasonSearch reads it back as a string.
                        search={(prev) => ({ ...prev, season: seasonParam(k) as string })}
                        aria-current={on ? 'page' : undefined}
                        className={`border-panel-line flex flex-1 items-center justify-center border-r px-2 py-2.5 text-lg whitespace-nowrap no-underline last:border-r-0 sm:flex-none sm:px-[22px] sm:py-0 sm:text-xl ${
                            on ? 'bg-brand text-white' : 'text-ink hover:bg-wash bg-white'
                        }`}
                    >
                        {seasonLabel(k)}
                    </Link>
                );
            })}
        </nav>
    );
}
