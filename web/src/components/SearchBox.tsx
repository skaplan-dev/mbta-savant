import { useId, useMemo, useState } from 'react';
import { matchCars, type SearchEntry } from '../carSearch';
import LineDot from './LineDot';

const MAX = 8;

/** The search combobox; `onWant` fires on first interaction so the caller can start loading. */
export default function SearchBox({
    label,
    entries,
    loading,
    onWant,
    onPick,
}: {
    label: string;
    entries: readonly SearchEntry[];
    loading: boolean;
    onWant: () => void;
    onPick: (e: SearchEntry) => void;
}) {
    const listId = useId();
    const [q, setQ] = useState('');
    const [active, setActive] = useState(0);
    const [open, setOpen] = useState(false);
    const term = q.trim();
    const matches = useMemo(() => (term ? matchCars(entries, term, MAX) : []), [entries, term]);
    const showList = open && term !== '';

    const show = () => {
        onWant();
        setOpen(true);
    };

    const go = (i: number) => {
        const e = matches[i];

        if (!e) return;
        setOpen(false);
        setQ('');
        onPick(e);
    };

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
                    setQ(ev.target.value);
                    setActive(0);
                    show();
                }}
                onFocus={show}
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
                            <LineDot group={e.group} className="size-[11px] flex-none" />
                            <span className="font-medium">{e.number}</span>
                            <span className="text-ink-2 truncate text-base">{e.fleet_label}</span>
                        </li>
                    ))}
                </ul>
            )}
        </form>
    );
}
