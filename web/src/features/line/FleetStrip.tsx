import type { FleetSummary } from '../../api';
import { fmtPace, fmtSaved, pace, timeSaved } from '../../format';

export default function FleetStrip({ fleets }: { fleets: FleetSummary[] }) {
    return (
        <section aria-label="Fleets" className="mb-6">
            <h2 className="text-ink-3 text-meta tracking-caps m-0 mb-2 font-medium">
                FLEETS · MEDIAN
            </h2>
            <ul className="m-0 flex list-none gap-3 overflow-x-auto p-0 pb-2">
                {fleets.map((f) => (
                    <li
                        key={f.fleet_label}
                        className="panel flex-none px-3.5 py-2.5"
                        style={{ minWidth: 190, maxWidth: 260 }}
                    >
                        <div className="text-ui truncate font-medium" title={f.fleet_label}>
                            {f.fleet_label}
                        </div>
                        <div className="text-ink-3 text-ui">
                            {f.cars} car{f.cars === 1 ? '' : 's'}
                        </div>
                        <div className="text-ui mt-1.5 flex gap-4">
                            <span>
                                <b className="font-medium">{fmtSaved(timeSaved(f.median))}</b>{' '}
                                <span className="text-ink-3 text-ui">saved</span>
                            </span>
                            <span>
                                <b className="font-medium">{fmtPace(pace(f.median))}</b>{' '}
                                <span className="text-ink-3 text-ui">pace</span>
                            </span>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
}
