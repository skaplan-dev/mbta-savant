import type { Car } from '../../api';
import LineDot from '../../components/LineDot';
import StatTerm from '../../components/StatTerm';
import { commonsUrl, fleetPhoto, photoSrc, type FleetPhoto } from '../../fleetPhotos';
import { fmtDate, fmtInt, fmtNum, fmtSaved, timeSaved } from '../../format';
import { GROUPS, type GroupId } from '../../groups';
import { isYearKey } from '../../seasons';
import CarArt from './CarArt';
import PartnerTable from './PartnerTable';
import { marriedMate } from './shared';
import type { CarFile } from './useCarData';

const HERO_BG = 'linear-gradient(#eef3f5, #eef3f5 72%, #d9e3e6 72%, #d9e3e6 74%, #e4ebed 74%)';

/** A photo of the car's fleet (not necessarily this car), with the credit its license requires. */
function HeroPhoto({ photo, alt }: { photo: FleetPhoto; alt: string }) {
    return (
        <>
            <img
                src={photoSrc(photo)}
                alt={alt}
                className="size-full object-cover"
                style={photo.position ? { objectPosition: photo.position } : undefined}
            />
            <a
                href={commonsUrl(photo)}
                target="_blank"
                rel="noreferrer"
                className="absolute top-1.5 right-1.5 rounded-[3px] bg-black/50 px-1.5 py-px text-[11px] text-white no-underline hover:underline"
            >
                Photo: {photo.artist}, {photo.license}
            </a>
        </>
    );
}

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
    car,
    files,
}: {
    group: GroupId;
    number: string;
    season: string;
    car: Car;
    files: CarFile[];
}) {
    const info = GROUPS[group];
    const v = car.vehicle;
    const mate = info.mode === 'rail' ? marriedMate(car) : null;
    const photo = fleetPhoto(v.fleet_key);

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
                    {photo ? (
                        <HeroPhoto
                            photo={photo}
                            alt={`A ${v.fleet_label} ${info.noun.toLowerCase()}`}
                        />
                    ) : (
                        <CarArt group={group} number={number} mate={mate} lengthFt={v.length_ft} />
                    )}
                </div>
                <div
                    className={`absolute -bottom-12 left-1/2 grid size-24 -translate-x-1/2 place-items-center rounded-full border-4 border-white font-bold tracking-[0.01em] shadow-[0_3px_10px_rgb(0_0_0/0.18)] ${
                        number.length > 4 ? 'text-subsection' : 'text-section'
                    } ${info.onColor}`}
                    style={{ background: info.color }}
                    aria-hidden="true"
                >
                    {number}
                </div>
            </div>
            <div className="px-[18px] pt-[58px] pb-1.5 text-center">
                <h1 id="carName" className="text-title m-0 mb-1.5 font-medium">
                    {info.noun} {number}
                </h1>
                <div className="text-lead mb-2 flex flex-wrap items-center justify-center gap-x-2.5">
                    <LineDot group={group} className="size-4" />
                    {info.name}
                    <span className="text-ink-3">|</span>
                    {v.builder ? `${v.builder} ${v.model ?? ''}` : 'Unknown builder'}
                </div>
                {specs.some(Boolean) && (
                    <p className="text-ui my-[3px]">
                        <Specs items={specs} />
                    </p>
                )}
                <p className="text-ui my-[3px]">
                    <Specs
                        items={[
                            !!v.years && `Built: ${v.years}`,
                            v.fleet_label || 'Unknown fleet',
                            !!car.last_seen && `Last seen: ${fmtDate(car.last_seen)}`,
                        ]}
                    />
                </p>
            </div>

            <SeasonTable files={files.filter((f) => isYearKey(f.window))} group={group} />

            <div className="min-w-0 px-[18px] pt-3 pb-5">
                <h3 className="text-lead mt-1.5 mb-2.5 font-bold">
                    <StatTerm id={info.partner.stat} />
                </h3>
                <PartnerTable car={car} group={group} season={season} compact />
            </div>
        </section>
    );
}

// Tighter cell padding under 320px, where even the columns that remain would not quite fit.
const th =
    'border-ink-2 border-b px-1 py-2 text-right font-bold whitespace-nowrap first:text-left @max-[20rem]:px-0.5';

const td = 'px-1 py-[7px] text-right whitespace-nowrap first:text-left @max-[20rem]:px-0.5';
const total = `${td} border-panel-line border-t`;

// Miles drops out when the table itself is under 360px wide (the card is narrow on phones and in the
// two-column layout), so the other columns fit without a hidden horizontal scroll. The percentile
// panel still shows Miles Logged.
const NARROW_HIDE = '@max-[22.5rem]:hidden';

/** One row per calendar year with a file, newest first, plus career totals. */
function SeasonTable({ files, group }: { files: CarFile[]; group: GroupId }) {
    if (!files.length) return null;
    const { showMiles } = GROUPS[group];
    const cars = files.map((f) => f.car);
    const trips = cars.reduce((t, c) => t + c.trips, 0);
    const miles = cars.reduce((t, c) => t + (c.miles ?? 0), 0);
    const ironHorse = Math.max(...cars.map((c) => c.iron_horse_days ?? 0));

    return (
        <div className="@container mx-3.5 mt-[18px] mb-2 overflow-x-auto">
            <table className="text-meta w-full border-collapse">
                <thead>
                    <tr>
                        <th className={th}>Season</th>
                        <th className={th}>Trips</th>
                        {showMiles && <th className={`${th} ${NARROW_HIDE}`}>Miles</th>}
                        <th className={th}>Saved/stop</th>
                        <th className={th}>On-Sched</th>
                        <th className={`${th} leading-tight whitespace-normal!`}>Streak</th>
                    </tr>
                </thead>
                <tbody>
                    {files.map(({ window, car: c }) => (
                        <tr key={window}>
                            <td className={td}>{window}</td>
                            <td className={td}>{fmtInt(c.trips)}</td>
                            {showMiles && (
                                <td className={`${td} ${NARROW_HIDE}`}>{fmtInt(c.miles)}</td>
                            )}
                            <td className={td}>{fmtSaved(timeSaved(c))}</td>
                            <td className={td}>{fmtNum(c.on_time_pct, 1, '%')}</td>
                            <td className={td}>{c.iron_horse_days ?? '–'}</td>
                        </tr>
                    ))}
                    <tr className="bg-wash font-bold">
                        <td className={total}>Total</td>
                        <td className={total}>{fmtInt(trips)}</td>
                        {showMiles && (
                            <td className={`${total} ${NARROW_HIDE}`}>{fmtInt(miles)}</td>
                        )}
                        <td className={total} />
                        <td className={total} />
                        <td className={total}>{ironHorse}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}
