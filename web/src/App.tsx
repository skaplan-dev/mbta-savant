import { useEffect, useState } from 'react';
import { fetchMeta, GROUPS, type Meta } from './api';
import CarPage from './CarPage';
import Leaderboard from './Leaderboard';

function latestSeason(meta: Meta): string {
    const years = meta.windows.map((w) => w.key).filter((k) => /^\d{4}$/.test(k));
    return years.sort().at(-1) ?? meta.windows[0]?.key ?? '';
}

export default function App() {
    const [meta, setMeta] = useState<Meta | null | undefined>(undefined);
    const params = new URLSearchParams(globalThis.location.search);

    useEffect(() => {
        fetchMeta()
            .then(setMeta)
            .catch(() => setMeta(null));
    }, []);

    let body;
    if (meta === undefined) body = <p>Loading...</p>;
    else if (meta === null) body = <p>No data published yet.</p>;
    else {
        const window = params.get('window') ?? latestSeason(meta);
        const car = params.get('car');
        const group = params.get('group') ?? 'red';
        body = (
            <>
                <nav>
                    Window:{' '}
                    {meta.windows.map((w) => (
                        <a key={w.key} href={`?window=${w.key}&group=${group}`}>
                            {w.key}{' '}
                        </a>
                    ))}
                    | Group:{' '}
                    {GROUPS.map((g) => (
                        <a key={g} href={`?window=${window}&group=${g}`}>
                            {g}{' '}
                        </a>
                    ))}
                </nav>
                {car ? (
                    <CarPage window={window} carId={car} />
                ) : (
                    <>
                        <h2>
                            {group} - {window}
                        </h2>
                        <Leaderboard window={window} group={group} />
                    </>
                )}
            </>
        );
    }

    return (
        <>
            <h1>MBTA Savant</h1>
            {body}
            <footer>
                <p>Vehicle data: The MBTA Vehicle Inventory Page (unofficial)</p>
                <p>A TransitMatters Labs fan site, not an official MBTA assessment.</p>
            </footer>
        </>
    );
}
