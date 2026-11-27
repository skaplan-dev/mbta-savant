import { Menu, MenuButton, MenuItem, MenuItems, MenuSeparator } from '@headlessui/react';
import { Link } from '@tanstack/react-router';
import { Check, ChevronDown } from 'lucide-react';
import { CAREER, isYearKey, LAST30, seasonLabel } from '../seasons';

const item =
    'text-ui sm:text-lead text-ink flex items-center justify-between gap-6 px-4 py-2 no-underline data-[focus]:bg-wash';

function SeasonItem({ k, on }: { k: string; on: boolean }) {
    return (
        <MenuItem>
            <Link
                to="."
                search={(prev) => ({ ...prev, season: k })}
                aria-current={on ? 'page' : undefined}
                className={`${item} ${on ? 'font-bold' : ''}`}
            >
                {seasonLabel(k)}
                {on ? (
                    <Check aria-hidden="true" className="text-brand size-4" />
                ) : (
                    <span className="size-4" />
                )}
            </Link>
        </MenuItem>
    );
}

/** The season picker: one dropdown listing All-time, the years newest first, then Last 30 Days. */
export default function SeasonToggle({ options, value }: { options: string[]; value: string }) {
    const years = options.filter(isYearKey).sort((a, b) => b.localeCompare(a));
    const groups = [
        options.includes(CAREER) ? [CAREER] : [],
        years,
        options.includes(LAST30) ? [LAST30] : [],
    ].filter((g) => g.length > 0);

    return (
        <Menu as="nav" aria-label="Season" className="flex">
            <MenuButton
                aria-label={`Season: ${seasonLabel(value)}`}
                className="border-panel-line rounded-panel text-lead hover:bg-wash data-[open]:bg-wash flex w-full cursor-pointer items-center justify-between gap-3 border bg-white px-[22px] py-2.5 font-medium sm:w-auto sm:min-w-[200px]"
            >
                {seasonLabel(value)}
                <ChevronDown aria-hidden="true" className="text-ink-2 size-5" />
            </MenuButton>
            <MenuItems
                anchor={{ to: 'bottom end', gap: 6 }}
                className="border-panel-line rounded-panel z-20 max-h-[min(70vh,28rem)] min-w-[var(--button-width)] overflow-y-auto border bg-white py-1 shadow-[var(--shadow-panel)] focus:outline-none"
            >
                {groups.map((g, i) => (
                    <div key={g[0]}>
                        {i > 0 && <MenuSeparator className="bg-panel-line my-1 h-px" />}
                        {g.map((k) => (
                            <SeasonItem key={k} k={k} on={k === value} />
                        ))}
                    </div>
                ))}
            </MenuItems>
        </Menu>
    );
}
