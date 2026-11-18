import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions } from '@headlessui/react';
import { useMemo, useState } from 'react';
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
    const [q, setQ] = useState('');
    const term = q.trim();
    const matches = useMemo(() => (term ? matchCars(entries, term, MAX) : []), [entries, term]);

    const pick = (e: SearchEntry | null) => {
        if (!e) return;
        setQ('');
        onPick(e);
    };

    return (
        <form
            role="search"
            className="relative md:flex-[0_1_520px]"
            // Enter with no highlighted option still opens the best match.
            onSubmit={(ev) => {
                ev.preventDefault();
                pick(matches[0] ?? null);
            }}
        >
            <Combobox<SearchEntry | null> value={null} onChange={pick} immediate>
                <ComboboxInput
                    type="search"
                    aria-label={label}
                    placeholder="Search a car or bus number"
                    autoComplete="off"
                    value={q}
                    displayValue={() => q}
                    onChange={(ev) => {
                        setQ(ev.target.value);
                        onWant();
                    }}
                    onFocus={onWant}
                    onKeyDown={(ev) => {
                        if (ev.key === 'Escape') setQ('');
                    }}
                    className="rounded-panel border-panel-line text-ink placeholder:text-ink-3 h-14 w-full border bg-white px-[18px] text-xl"
                />
                {term !== '' && (
                    <ComboboxOptions className="panel absolute top-full right-0 left-0 z-20 mt-1.5 list-none p-1 empty:invisible">
                        {matches.length === 0 && (
                            <li className="text-ink-3 px-3 py-2 text-lg">
                                {loading ? 'Loading…' : 'No match'}
                            </li>
                        )}
                        {matches.map((e) => (
                            <ComboboxOption
                                key={e.car_id}
                                value={e}
                                className="data-focus:bg-wash flex cursor-pointer items-center gap-3 rounded px-3 py-2 text-xl"
                            >
                                <LineDot group={e.group} className="size-[11px] flex-none" />
                                <span className="font-medium">{e.number}</span>
                                <span className="text-ink-2 truncate text-base">
                                    {e.fleet_label}
                                </span>
                            </ComboboxOption>
                        ))}
                    </ComboboxOptions>
                )}
            </Combobox>
        </form>
    );
}
