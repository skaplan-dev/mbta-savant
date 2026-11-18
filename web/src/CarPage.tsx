import { useEffect, useState } from 'react';
import {
    fetchCar,
    fmt,
    fmtMetric,
    fmtVsAvg,
    isVsAvg,
    METRICS,
    UNRANKED,
    VS_AVG,
    type Car,
} from './api';

export default function CarPage({ window, carId }: { window: string; carId: string }) {
    const [car, setCar] = useState<Car | null | undefined>(undefined);
    const [group, number] = carId.split(':');

    useEffect(() => {
        let live = true;
        setCar(undefined);
        fetchCar(window, group ?? '', number ?? '')
            .then((d) => live && setCar(d))
            .catch(() => live && setCar(null));
        return () => {
            live = false;
        };
    }, [window, group, number]);

    if (car === undefined) return <p>Loading...</p>;
    if (car === null)
        return (
            <p>
                No data for {carId} in {window}.
            </p>
        );

    return (
        <div>
            <p>
                <a href={`?window=${window}&group=${group}`}>&larr; {group} leaderboard</a>
            </p>
            <h2>
                {car.car_id} {car.qualified ? '' : '(unqualified)'}
            </h2>
            <h3>Vehicle</h3>
            <table>
                <tbody>
                    {Object.entries(car.vehicle).map(([k, v]) => (
                        <tr key={k}>
                            <th>{k}</th>
                            <td>{v === null || v === undefined ? '-' : String(v)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <h3>Stats</h3>
            <table>
                <thead>
                    <tr>
                        <th>Metric</th>
                        <th>Value</th>
                        <th>Percentile</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>trips</td>
                        <td>{car.trips}</td>
                        <td>-</td>
                    </tr>
                    {METRICS.map((m) => (
                        <tr key={m}>
                            <td>{isVsAvg(m) ? VS_AVG[m].label : m}</td>
                            <td>
                                {isVsAvg(m) ? (
                                    <>
                                        {fmtVsAvg(m, car[VS_AVG[m].field])}{' '}
                                        <small>({fmtMetric(m, car[m])})</small>
                                    </>
                                ) : (
                                    fmtMetric(m, car[m])
                                )}
                            </td>
                            <td>{UNRANKED.has(m) ? '' : fmt(car.pct[m])}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <h3>Game log</h3>
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Trips</th>
                        <th>Miles</th>
                        <th>ttoe_sec</th>
                        <th>Routes</th>
                    </tr>
                </thead>
                <tbody>
                    {car.game_log.map((g) => (
                        <tr key={g.date}>
                            <td>{g.date}</td>
                            <td>{g.trips}</td>
                            <td>{fmt(g.miles)}</td>
                            <td>{fmt(g.ttoe_sec)}</td>
                            <td>{g.routes.join(', ')}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
