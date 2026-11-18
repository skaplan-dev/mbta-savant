import { Link } from '@tanstack/react-router';
import type { Car } from '../../api';
import LineDot from '../../components/LineDot';
import StatTerm from '../../components/StatTerm';
import { fmtInt, fmtSaved, fmtUnit, timeSaved } from '../../format';
import { GROUPS, type GroupId } from '../../groups';
import { isYearKey } from '../../seasons';
import CarArt from './CarArt';
import PartnerTable from './PartnerTable';
import { marriedMate } from './shared';
import type { CarFile } from './useCarData';

const HERO_BG = 'linear-gradient(#eef3f5, #eef3f5 72%, #d9e3e6 72%, #d9e3e6 74%, #e4ebed 74%)';

const pageLink = 'text-ink hover:text-brand block py-0.5 no-underline hover:underline';

const Sep = () => <span className="text-ink-3 mx-1.5">|</span>;

function Specs({ items }: { items: (string | false | undefined)[] }) {
    const shown = items.filter((s) => s !== false && s !== undefined);

    return shown.map((s, i) => (
        <span key={s}>
            {i > 0 && <Sep />}
            {s}
        </span>
    ));
}

export default function BioPanel({
    group,
    number,
    season,
    hasSeasonData,
    car,
    files,
}: {
    group: GroupId;
    number: string;
    /** The selected season; carried onto the leaderboard and teammate links. */
    season: string;
    /** False when the car has no file for `season`; the Game Log and partner links are hidden. */
    hasSeasonData: boolean;
    car: Car;
    files: CarFile[];
}) {
    const info = GROUPS[group];
    const v = car.vehicle;
    const mate = info.mode === 'rail' ? marriedMate(car) : null;

    const specs = [
        !!mate && `Married pair: ${number}/${mate}`,
        !!v.length_ft && `${v.length_ft} ft`,
        !!v.propulsion && v.propulsion.charAt(0).toUpperCase() + v.propulsion.slice(1),
        !!v.garage && `Garage: ${v.garage}`,
    ];

    return (
        <section className="panel" aria-labelledby="carName">
            <div className="relative">
                <div className="relative h-[196px] overflow-hidden" style={{ background: HERO_BG }}>
                    <CarArt group={group} number={number} mate={mate} lengthFt={v.length_ft} />
                </div>
                <div
                    className={`absolute -bottom-12 left-1/2 grid size-24 -translate-x-1/2 place-items-center rounded-full border-4 border-white font-bold tracking-[0.01em] shadow-[0_3px_10px_rgb(0_0_0/0.18)] ${
                        number.length > 4 ? 'text-2xl' : 'text-[30px]'
                    } ${info.onColor}`}
                    style={{ background: info.color }}
                    aria-hidden="true"
                >
                    {number}
                </div>
            </div>
            <div className="px-[18px] pt-[58px] pb-1.5 text-center">
                <h1 id="carName" className="m-0 mb-1.5 text-[40px] font-medium tracking-[-0.01em]">
                    {info.noun} {number}
                </h1>
                <div className="mb-2 flex flex-wrap items-center justify-center gap-x-2.5 text-2xl">
                    <LineDot group={group} className="size-4" />
                    {info.name}
                    <span className="text-ink-3">|</span>
                    {v.builder ? `${v.builder} ${v.model ?? ''}` : 'Unknown builder'}
                </div>
                {specs.some(Boolean) && (
                    <p className="my-[3px] text-lg">
                        <Specs items={specs} />
                    </p>
                )}
                <p className="my-[3px] text-lg">
                    <Specs
                        items={[!!v.years && `Built: ${v.years}`, v.fleet_label || 'Unknown fleet']}
                    />
                </p>
            </div>

            <SeasonTable files={files.filter((f) => isYearKey(f.window))} group={group} />

            <div className="grid gap-3.5 px-[18px] pt-3 pb-5 min-[761px]:grid-cols-[0.9fr_1.4fr]">
                <div>
                    <h3 className="mt-1.5 mb-2.5 text-2xl font-medium">{info.noun} Pages</h3>
                    <ul className="m-0 list-none p-0 text-lg">
                        {hasSeasonData && (
                            <li>
                                <Link
                                    from="/car/$group/$number"
                                    to="."
                                    search={(prev) => ({ ...prev, tab: undefined })}
                                    hash="tabs"
                                    resetScroll={false}
                                    className={pageLink}
                                >
                                    Game Log
                                </Link>
                            </li>
                        )}
                        <li>
                            <Link to="/glossary" className={pageLink}>
                                Stat Glossary
                            </Link>
                        </li>
                        {hasSeasonData && (
                            <li>
                                <Link
                                    from="/car/$group/$number"
                                    to="."
                                    search={(prev) => ({ ...prev, tab: 'mates' })}
                                    hash="tabs"
                                    resetScroll={false}
                                    className={pageLink}
                                >
                                    {info.partner.link}
                                </Link>
                            </li>
                        )}
                        <li>
                            <Link
                                to="/line/$group"
                                params={{ group }}
                                search={{ season }}
                                className={pageLink}
                            >
                                Line Leaderboard
                            </Link>
                        </li>
                    </ul>
                </div>
                <div className="min-w-0">
                    <h3 className="mt-1.5 mb-2.5 text-2xl font-medium">
                        <StatTerm id={info.partner.stat} />
                    </h3>
                    <PartnerTable car={car} group={group} season={season} compact />
                </div>
            </div>
        </section>
    );
}

const th = 'border-ink-2 border-b px-1 py-2 text-right font-bold whitespace-nowrap first:text-left';
const td = 'px-1 py-[7px] text-right whitespace-nowrap first:text-left';
const total = `${td} border-panel-line border-t`;

/** One row per calendar year with a file, newest first, plus career totals. */
function SeasonTable({ files, group }: { files: CarFile[]; group: GroupId }) {
    if (!files.length) return null;
    const { showMiles } = GROUPS[group];
    const cars = files.map((f) => f.car);
    const trips = cars.reduce((t, c) => t + c.trips, 0);
    const miles = cars.reduce((t, c) => t + (c.miles ?? 0), 0);
    const ironHorse = Math.max(...cars.map((c) => c.iron_horse_days ?? 0));

    return (
        <div className="mx-3.5 mt-[18px] mb-2 overflow-x-auto">
            <table className="w-full border-collapse text-[15px]">
                <thead>
                    <tr>
                        <th className={th}>Season</th>
                        <th className={th}>Trips</th>
                        {showMiles && <th className={th}>Miles</th>}
                        <th className={th}>Saved/stop</th>
                        <th className={th}>On-Sched</th>
                        <th className={`${th} leading-tight whitespace-normal!`}>Iron Horse</th>
                    </tr>
                </thead>
                <tbody>
                    {files.map(({ window, car: c }) => (
                        <tr key={window}>
                            <td className={td}>{window}</td>
                            <td className={td}>{fmtInt(c.trips)}</td>
                            {showMiles && <td className={td}>{fmtInt(c.miles)}</td>}
                            <td className={td}>{fmtSaved(timeSaved(c))}</td>
                            <td className={td}>{fmtUnit(c.on_time_pct, 1, '%')}</td>
                            <td className={td}>{c.iron_horse_days ?? '–'}</td>
                        </tr>
                    ))}
                    <tr className="bg-wash font-bold">
                        <td className={total}>
                            {files.length} Season{files.length === 1 ? '' : 's'}
                        </td>
                        <td className={total}>{fmtInt(trips)}</td>
                        {showMiles && <td className={total}>{fmtInt(miles)}</td>}
                        <td className={total} />
                        <td className={total} />
                        <td className={total}>{ironHorse}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}
