import { useNavigate } from '@tanstack/react-router';
import { useId, useState } from 'react';
import { GROUP_IDS, GROUPS, isGroup } from '../format';
import { defaultWindow, useAllIndexes } from '../queries';
import { mergeIndexes, seasonParam } from '../search';

const MAX = 8;

export default function Search({ label = 'Search a car or bus number' }: { label?: string }) {
    const navigate = useNavigate();
    const listId = useId();
    // Indexes load on first focus or keystroke, not on mount; every window is searched so cars
    // without data in the newest year are still found.
    const [wanted, setWanted] = useState(false);
    const { meta, windows, indexes, loading: loadingIndexes } = useAllIndexes(wanted);
    const win = defaultWindow(meta);
    const loading = wanted && loadingIndexes;
    const [q, setQ] = useState('');
    const [active, setActive] = useState(0);
    const [open, setOpen] = useState(false);

    // A few thousand entries at most; recomputed per render rather than memoized on the rebuilt `indexes`.
    const matches = (() => {
        const term = q.trim();

        if (!term) return [];

        return mergeIndexes(windows, indexes)
            .filter((e) => e.number.startsWith(term) && isGroup(e.group))
            .sort(
                (a, b) =>
                    Number(b.number === term) - Number(a.number === term) ||
                    a.number.localeCompare(b.number, undefined, { numeric: true }) ||
                    GROUP_IDS.indexOf(a.group as never) - GROUP_IDS.indexOf(b.group as never)
            )
            .slice(0, MAX);
    })();

    const go = (i: number) => {
        const e = matches[i];

        if (!e) return;
        setOpen(false);
        setQ('');
        void navigate({
            to: '/car/$group/$number',
            params: { group: e.group, number: e.number },
            // Cars with no data in the default window link to the season that has it.
            search: e.window === win ? {} : { season: seasonParam(e.window) as string },
        });
    };

    const showList = open && q.trim() !== '';

    return (
        <form
            role="search"
            className="relative md:flex-[0_1_520px]"
            onSubmit={(ev) => {
                ev.preventDefault();
                go(active);
            }}
        >
            <input
                type="search"
                role="combobox"
                aria-expanded={showList}
                aria-controls={showList ? listId : undefined}
                aria-autocomplete="list"
                aria-activedescendant={
                    showList && matches[active] ? `${listId}-${active}` : undefined
                }
                aria-label={label}
                placeholder="Search a car or bus number"
                autoComplete="off"
                value={q}
                onChange={(ev) => {
                    setWanted(true);
                    setQ(ev.target.value);
                    setActive(0);
                    setOpen(true);
                }}
                onFocus={() => {
                    setWanted(true);
                    setOpen(true);
                }}
                onBlur={() => setOpen(false)}
                onKeyDown={(ev) => {
                    if (ev.key === 'ArrowDown') {
                        ev.preventDefault();
                        setActive((a) => Math.max(0, Math.min(a + 1, matches.length - 1)));
                    } else if (ev.key === 'ArrowUp') {
                        ev.preventDefault();
                        setActive((a) => Math.max(a - 1, 0));
                    } else if (ev.key === 'Escape') {
                        setOpen(false);
                        setQ('');
                    }
                }}
                className="rounded-panel border-panel-line text-ink placeholder:text-ink-3 h-14 w-full border bg-white px-[18px] text-xl"
            />
            {showList && (
                <ul
                    id={listId}
                    role="listbox"
                    className="panel absolute top-full right-0 left-0 z-20 mt-1.5 list-none p-1"
                >
                    {matches.length === 0 && (
                        <li className="text-ink-3 px-3 py-2 text-lg">
                            {loading ? 'Loading…' : 'No match'}
                        </li>
                    )}
                    {matches.map((e, i) => (
                        <li
                            key={e.car_id}
                            id={`${listId}-${i}`}
                            role="option"
                            aria-selected={i === active}
                            // mouseDown fires before the input's blur closes the list
                            onMouseDown={(ev) => {
                                ev.preventDefault();
                                go(i);
                            }}
                            onMouseEnter={() => setActive(i)}
                            className={`flex cursor-pointer items-center gap-3 rounded px-3 py-2 text-xl ${i === active ? 'bg-wash' : ''}`}
                        >
                            <span
                                className="size-[11px] flex-none rounded-full"
                                style={{ background: GROUPS[e.group as keyof typeof GROUPS].color }}
                            />
                            <span className="font-medium">{e.number}</span>
                            <span className="text-ink-2 truncate text-base">{e.fleet_label}</span>
                        </li>
                    ))}
                </ul>
            )}
        </form>
    );
}
