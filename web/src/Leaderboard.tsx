import { useEffect, useMemo, useState } from 'react';
import { fetchGroup, fmt, METRICS, type CarStats, type GroupFile, type Metric } from './api';

type SortKey = Metric | 'number';

function sortValue(c: CarStats, key: SortKey): number | string | null {
    if (key === 'number') return c.number;
    const v = c[key];
    return Array.isArray(v) ? v.length : v;
}

export default function Leaderboard({ window, group }: { window: string; group: string }) {
    const [data, setData] = useState<GroupFile | null | undefined>(undefined);
    const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'ttoe_sec', dir: 1 });

    useEffect(() => {
        let live = true;
        setData(undefined);
        fetchGroup(window, group)
            .then((d) => live && setData(d))
            .catch(() => live && setData(null));
        return () => {
            live = false;
        };
    }, [window, group]);

    const rows = useMemo(() => {
        if (!data) return [];
        const { key, dir } = sort;
        return [...data.cars].sort((a, b) => {
            if (a.qualified !== b.qualified) return a.qualified ? -1 : 1;
            const x = sortValue(a, key);
            const y = sortValue(b, key);
            if (x === null && y === null) return 0;
            if (x === null) return 1;
            if (y === null) return -1;
            return (x < y ? -1 : x > y ? 1 : 0) * dir;
        });
    }, [data, sort]);

    if (data === undefined) return <p>Loading...</p>;
    if (data === null)
        return (
            <p>
                No data for {group} in {window}.
            </p>
        );

    const head = (key: SortKey) =>
        setSort((s) => ({ key, dir: s.key === key && s.dir === 1 ? -1 : 1 }));

    return (
        <table>
            <thead>
                <tr>
                    <th className="sortable" onClick={() => head('number')}>
                        Car
                    </th>
                    <th>Fleet</th>
                    {METRICS.map((m) => (
                        <th key={m} className="sortable" onClick={() => head(m)}>
                            {m}
                            {sort.key === m ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.map((c) => (
                    <tr key={c.car_id} className={c.qualified ? '' : 'unqualified'}>
                        <td>
                            <a href={`?window=${window}&car=${c.car_id}`}>{c.number}</a>
                        </td>
                        <td>{c.vehicle.fleet_label}</td>
                        {METRICS.map((m) => (
                            <td key={m}>
                                {fmt(c[m])} ({fmt(c.pct[m])})
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
