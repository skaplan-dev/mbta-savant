import { Link } from '@tanstack/react-router';
import { seasonLabel } from '../seasons';

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
                        search={(prev) => ({ ...prev, season: k })}
                        aria-current={on ? 'page' : undefined}
                        className={`border-panel-line text-ui sm:text-lead flex flex-1 items-center justify-center border-r px-2 py-2.5 whitespace-nowrap no-underline last:border-r-0 sm:flex-none sm:px-[22px] sm:py-0 ${
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
