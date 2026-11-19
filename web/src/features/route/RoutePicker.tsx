import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions } from '@headlessui/react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import type { RouteIndexEntry } from '../../api';
import { matchRoutes, routeLabel } from '../../busRoutes';
import { fmtInt } from '../../format';
import { routeIndexQuery } from '../../queries';

/** On the bus leaderboard: jump to one route's board for the same season. */
export default function RoutePicker({ season }: { season: string }) {
    const navigate = useNavigate();
    const { data } = useQuery(routeIndexQuery(season));
    const [q, setQ] = useState('');
    const matches = useMemo(() => matchRoutes(data ?? [], q.trim()), [data, q]);

    if (!data?.length) return null;

    const pick = (e: RouteIndexEntry | null) => {
        if (!e) return;
        setQ('');
        void navigate({ to: '/route/$route', params: { route: e.route }, search: { season } });
    };

    return (
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <label htmlFor="route-picker" className="text-ui font-medium">
                Route leaderboards
            </label>
            <form
                className="relative sm:w-[320px]"
                onSubmit={(ev) => {
                    ev.preventDefault();
                    pick(matches[0] ?? null);
                }}
            >
                <Combobox<RouteIndexEntry | null> value={null} onChange={pick} immediate>
                    <ComboboxInput
                        id="route-picker"
                        placeholder="Pick a route, e.g. 28 or SL1"
                        autoComplete="off"
                        value={q}
                        displayValue={() => q}
                        onChange={(ev) => setQ(ev.target.value)}
                        className="rounded-panel border-panel-line text-ink placeholder:text-ink-3 text-ui h-11 w-full border bg-white px-3.5"
                    />
                    <ComboboxOptions className="panel absolute top-full right-0 left-0 z-20 mt-1.5 max-h-80 list-none overflow-y-auto p-1 empty:invisible">
                        {matches.length === 0 && (
                            <li className="text-ink-3 text-ui px-3 py-2">No match</li>
                        )}
                        {matches.map((e) => (
                            <ComboboxOption
                                key={e.route}
                                value={e}
                                className="data-focus:bg-wash text-ui flex cursor-pointer items-center justify-between gap-3 rounded px-3 py-1.5"
                            >
                                <span className="font-medium">{routeLabel(e.route)}</span>
                                <span className="text-ink-2 text-meta">
                                    {e.ranked_cars > 0
                                        ? `${fmtInt(e.ranked_cars)} ranked`
                                        : 'not enough trips'}
                                </span>
                            </ComboboxOption>
                        ))}
                    </ComboboxOptions>
                </Combobox>
            </form>
        </div>
    );
}
