import type { Car, WindowInfo } from '../../api';
import PanelHeader from '../../components/PanelHeader';
import InfoPopover from '../../components/InfoPopover';
import { pctColor } from '../../format';
import { LAST30 } from '../../seasons';
import { dayScore, monthSummaries, savedShort } from './calendar';
import { LastThirtyGrid, YearGrid, type DayLookup } from './CalendarGrids';

const HELP =
    'Each square is a service day, colored by Time Saved that day: red = faster than the line’s average car, blue = slower.';

const HELP_BUTTON =
    'border-brand-2 text-brand-2 hover:bg-wash grid size-[30px] cursor-pointer place-items-center rounded-full border-[1.5px] bg-transparent p-0 text-[17px]';

// Nine months fit the panel without scrolling at every width.
const SUMMARY_MONTHS = 9;
const th = 'px-0.5 py-1 text-[15px] font-medium';
const td = 'px-0.5 py-[5px] text-center';
const rowHead = 'text-brand pr-1.5 text-left text-base whitespace-nowrap';

export default function CalendarPanel({
    season,
    car,
    avg,
    window,
    latest,
}: {
    season: string;
    car: Car;
    /** The line's average ttoe_sec for this window (group file `averages.ttoe_sec`). */
    avg: number | null;
    window: WindowInfo | undefined;
    latest: string | null;
}) {
    const lookup: DayLookup = { days: new Map(car.game_log.map((g) => [g.date, g])), avg };
    const summary = monthSummaries(car.game_log, SUMMARY_MONTHS);

    return (
        <section className="panel min-[761px]:max-[1179px]:col-span-2" aria-labelledby="calTitle">
            <PanelHeader id="calTitle" season={season} title="Service Calendar">
                <InfoPopover
                    trigger="?"
                    triggerClass={HELP_BUTTON}
                    triggerLabel="About the service calendar"
                    className="flex-none"
                >
                    {HELP}
                </InfoPopover>
            </PanelHeader>
            <div className="text-ink-2 mt-0.5 mb-2.5 flex flex-wrap items-center justify-center gap-2.5 text-[15px]">
                <span>SLOWER</span>
                <span className="h-2.5 w-40 bg-[linear-gradient(90deg,var(--color-poor),var(--color-scale-mid),var(--color-great))]" />
                <span>FASTER</span>
                <span className="ml-2.5 inline-flex items-center gap-1.5">
                    <i className="bg-track inline-block size-3" />
                    didn&rsquo;t run
                </span>
            </div>
            <div className="px-4 pt-1 pb-1.5">
                {season === LAST30 ? (
                    <LastThirtyGrid
                        lookup={lookup}
                        start={window?.start ?? car.game_log[0]?.date}
                        end={window?.end ?? latest ?? car.game_log.at(-1)?.date}
                    />
                ) : (
                    <YearGrid lookup={lookup} season={season} latest={latest} />
                )}
            </div>
            {summary.length > 0 && (
                <div className="mx-3.5 mt-2 mb-[18px] overflow-x-auto">
                    <table className="w-full border-collapse text-[15px]">
                        <thead>
                            <tr>
                                <th className={th} />
                                {summary.map((m) => (
                                    <th key={m.key} className={th}>
                                        {m.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className={rowHead} />
                                {summary.map((m) => (
                                    <td key={m.key} className={td}>
                                        <span
                                            className="mx-0.5 mb-0.5 block h-2.5 rounded-[3px]"
                                            style={{ background: pctColor(dayScore(m.ttoe, avg)) }}
                                        />
                                    </td>
                                ))}
                            </tr>
                            <tr>
                                <td className={rowHead}>DAYS</td>
                                {summary.map((m) => (
                                    <td key={m.key} className={td}>
                                        {m.days}
                                    </td>
                                ))}
                            </tr>
                            <tr>
                                <td className={rowHead}>TRIPS/DAY</td>
                                {summary.map((m) => (
                                    <td key={m.key} className={td}>
                                        {m.tripsPerDay}
                                    </td>
                                ))}
                            </tr>
                            <tr>
                                <td className={`${rowHead} italic`}>SAVED/STOP</td>
                                {summary.map((m) => (
                                    <td key={m.key} className={td}>
                                        {m.ttoe == null || avg == null
                                            ? '–'
                                            : savedShort(avg - m.ttoe)}
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
