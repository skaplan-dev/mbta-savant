import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { linkSeason, mergeIndexes } from '../carSearch';
import { useAllIndexes } from '../queries';
import { defaultWindow } from '../seasons';
import SearchBox from './SearchBox';

/** Car search over every window's index, loaded on first focus or keystroke rather than on mount. */
export default function Search({ label = 'Search a car or bus number' }: { label?: string }) {
    const navigate = useNavigate();
    const [wanted, setWanted] = useState(false);
    const { windows, indexes, loading } = useAllIndexes(wanted);
    const entries = useMemo(() => mergeIndexes(windows, indexes), [windows, indexes]);

    return (
        <SearchBox
            label={label}
            entries={entries}
            loading={wanted && loading}
            onWant={() => setWanted(true)}
            onPick={(e) =>
                void navigate({
                    to: '/car/$group/$number',
                    params: { group: e.group, number: e.number },
                    search: { season: linkSeason(e, defaultWindow(windows)) },
                })
            }
        />
    );
}
