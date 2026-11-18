import { useNavigate } from '@tanstack/react-router';
import { useId, useMemo, useState } from 'react';
import { GROUP_IDS, GROUPS, isGroup } from '../format';
import { defaultWindow, useIndex, useMeta } from '../queries';

const MAX = 8;

export default function Search({ label = 'Search a car or bus number' }: { label?: string }) {
    const navigate = useNavigate();
    const listId = useId();
    const { data: meta, isPending: metaPending } = useMeta();
    const win = defaultWindow(meta);
    const { data: index, isPending: indexPending } = useIndex(win);
    // Loading until the index resolves; a missing meta or index file means no data, not loading.
    const loading = metaPending || (!!win && indexPending);
    const [q, setQ] = useState('');
    const [active, setActive] = useState(0);
    const [open, setOpen] = useState(false);

    const matches = useMemo(() => {
        const term = q.trim();
        if (!term || !index) return [];
        return index
            .filter((e) => e.number.startsWith(term) && isGroup(e.group))
            .sort(
                (a, b) =>
                    Number(b.number === term) - Number(a.number === term) ||
                    a.number.localeCompare(b.number, undefined, { numeric: true }) ||
                    GROUP_IDS.indexOf(a.group as never) - GROUP_IDS.indexOf(b.group as never)
            )
            .slice(0, MAX);
    }, [q, index]);

    const go = (i: number) => {
        const e = matches[i];
        if (!e) return;
        setOpen(false);
        setQ('');
        void navigate({ to: '/car/$group/$number', params: { group: e.group, number: e.number } });
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
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={
                    showList && matches[active] ? `${listId}-${active}` : undefined
                }
                aria-label={label}
                placeholder="Search a car or bus number"
                autoComplete="off"
                value={q}
                onChange={(ev) => {
                    setQ(ev.target.value);
                    setActive(0);
                    setOpen(true);
                }}
                onFocus={() => setOpen(true)}
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
