import { CircleQuestionMark } from 'lucide-react';
import { useState } from 'react';
import type { Car, WindowInfo } from '../../api';
import PanelHeader from '../../components/PanelHeader';
import InfoPopover from '../../components/InfoPopover';
import { LAST30 } from '../../seasons';
import { dayText, monthSummaries, savedShort } from './calendar';
import { LastThirtyGrid, YearGrid, type DayLookup } from './CalendarGrids';

const HELP =
    'Each square is a service day, colored by Time Saved that day: red = faster than the line’s typical car, blue = slower.';

const HELP_BUTTON =
    "text-brand hover:bg-wash relative grid size-8 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 before:absolute before:-inset-2 before:content-['']";

// Nine months fit the panel without scrolling; on a narrow phone the oldest two or three drop out.
const SUMMARY_MONTHS = 9;
const NARROW_MONTHS = 7;
const th = 'px-0.5 py-1 text-meta font-medium';
const td = 'px-0.5 py-[5px] text-center';
const rowHead = 'text-brand pr-1.5 text-left text-ui whitespace-nowrap';

export default function CalendarPanel({
    season,
    car,
    typical,
    segs,
    window,
    latest,
}: {
    season: string;
    car: Car;
    /** The line's typical car's trip_time_sec for this window (group file `typical`). */
    typical: number | null;
    /** Segments per trip on the line (group file `segs_per_trip`). */
    segs: number | null;
    window: WindowInfo | undefined;
    latest: string | null;
}) {
    const [picked, setPicked] = useState<string | null>(null);
    const lookup: DayLookup = {
        days: new Map(car.game_log.map((g) => [g.date, g])),
        typical,
        segs,
    };
    const summary = monthSummaries(car.game_log, SUMMARY_MONTHS);

    // In a table under 352px wide only the newest seven months fit; under 320px, six.
    const drop = (i: number) => {
        if (i < summary.length - NARROW_MONTHS) return '@max-[22rem]:hidden';

        return i < summary.length - NARROW_MONTHS + 1 ? '@max-[20rem]:hidden' : '';
    };

    return (
        <section className="panel min-[761px]:max-[1179px]:col-span-2" aria-labelledby="calTitle">
            <PanelHeader id="calTitle" season={season} title="Service Calendar">
                <InfoPopover
                    trigger={<CircleQuestionMark className="size-6" strokeWidth={1.75} />}
                    triggerClass={HELP_BUTTON}
                    triggerLabel="About the service calendar"
                    className="flex-none"
                >
                    {HELP}
                </InfoPopover>
            </PanelHeader>
            <div className="text-ink-2 text-meta mt-0.5 mb-2.5 flex flex-wrap items-center justify-center gap-2.5">
                <span>SLOWER</span>
                <span className="h-2.5 w-40 bg-[linear-gradient(90deg,var(--color-poor),var(--color-scale-mid),var(--color-great))]" />
                <span>FASTER</span>
                <span className="ml-2.5 inline-flex items-center gap-1.5">
                    <i className="bg-track inline-block size-3" />
                    didn&rsquo;t run
                </span>
            </div>
            {/* Hover titles don't exist on touch, so a tapped day reads out here. */}
            <p role="status" className="text-ink-2 text-ui m-0 min-h-[1.3em] px-4 text-center">
                {picked
                    ? dayText(picked, lookup.days.get(picked), typical)
                    : 'Select a day for its details.'}
            </p>
            <div className="px-4 pt-1 pb-1.5">
                {season === LAST30 ? (
                    <LastThirtyGrid
                        selected={picked}
                        onPick={setPicked}
                        lookup={lookup}
                        start={window?.start ?? car.game_log[0]?.date}
                        end={window?.end ?? latest ?? car.game_log.at(-1)?.date}
                    />
                ) : (
                    <YearGrid
                        selected={picked}
                        onPick={setPicked}
                        lookup={lookup}
                        season={season}
                        latest={latest}
                    />
                )}
            </div>
            {summary.length > 0 && (
                <div className="@container mx-3.5 mt-2 mb-[18px] overflow-x-auto">
                    <table className="text-meta w-full border-collapse">
                        <thead>
                            <tr>
                                <th className={th} />
                                {summary.map((m, i) => (
                                    <th key={m.key} className={`${th} ${drop(i)}`}>
                                        {m.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className={rowHead}>DAYS</td>
                                {summary.map((m, i) => (
                                    <td key={m.key} className={`${td} ${drop(i)}`}>
                                        {m.days}
                                    </td>
                                ))}
                            </tr>
                            <tr>
                                <td className={rowHead}>TRIPS/DAY</td>
                                {summary.map((m, i) => (
                                    <td key={m.key} className={`${td} ${drop(i)}`}>
                                        {m.tripsPerDay}
                                    </td>
                                ))}
                            </tr>
                            <tr>
                                <td className={`${rowHead} italic`}>SAVED/TRIP</td>
                                {summary.map((m, i) => (
                                    <td key={m.key} className={`${td} ${drop(i)}`}>
                                        {m.trip == null || typical == null
                                            ? '–'
                                            : savedShort(typical - m.trip)}
                                    </td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
