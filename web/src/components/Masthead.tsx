import { Link, useRouterState } from '@tanstack/react-router';
import { GROUP_IDS, GROUPS } from '../groups';
import Emblem from './Emblem';
import LineDot from './LineDot';
import Search from './Search';

const navLink =
    'inline-flex items-center gap-2 text-lg text-ink no-underline hover:text-brand sm:text-[21px] [&.active]:text-brand';

export default function Masthead() {
    // The home page has its own large search.
    const isHome = useRouterState({ select: (s) => s.location.pathname === '/' });

    return (
        <>
            <header className="border-panel-line flex flex-col items-stretch justify-between gap-6 border-b pt-5 pb-3.5 md:flex-row md:items-center">
                <Link
                    to="/"
                    aria-label="MBTA Savant home"
                    className="flex items-center gap-3.5 text-inherit no-underline"
                >
                    <Emblem className="size-[60px] flex-none md:size-[76px]" />
                    <span className="leading-[0.9]">
                        <span className="text-brand text-[44px] font-normal tracking-[-0.01em] md:text-[56px]">
                            <b className="text-ink mr-2 font-bold tracking-normal">MBTA</b>savant
                        </span>
                        <span className="text-ink-2 mt-1.5 block text-base font-light md:text-[19px]">
                            every car, every trip &middot;{' '}
                            <strong className="text-ink font-medium">
                                a TransitMatters Labs project
                            </strong>
                        </span>
                    </span>
                </Link>
                {!isHome && <Search />}
            </header>
            <nav
                aria-label="Main"
                className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-4 pb-3.5 sm:gap-x-[30px]"
            >
                <Link to="/" className={navLink} activeOptions={{ exact: true }}>
                    Leaderboards
                </Link>
                {GROUP_IDS.map((g) => (
                    <Link key={g} to="/line/$group" params={{ group: g }} className={navLink}>
                        <LineDot group={g} className="inline-block size-[11px]" />
                        {GROUPS[g].short}
                    </Link>
                ))}
                <Link to="/glossary" className={navLink}>
                    Glossary
                </Link>
            </nav>
        </>
    );
}
