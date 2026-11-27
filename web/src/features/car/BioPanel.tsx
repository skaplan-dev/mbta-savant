import { Link } from '@tanstack/react-router';
import type { Car, CareerCar } from '../../api';
import LineDot from '../../components/LineDot';
import StatTerm from '../../components/StatTerm';
import { commonsUrl, fleetPhoto, photoSrc, type FleetPhoto } from '../../fleetPhotos';
import {
    fmtDate,
    fmtInt,
    fmtNum,
    fmtSaved,
    fmtSavedPct,
    fmtTrips,
    pctColor,
    savedPct,
    timeSaved,
    tint,
} from '../../format';
import { GROUPS, type GroupId } from '../../groups';
import { CAREER, seasonLabel } from '../../seasons';
import CarArt from './CarArt';
import PartnerTable from './PartnerTable';
import { marriedMate } from './shared';

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
    career,
    car,
}: {
    group: GroupId;
    number: string;
    season: string;
    /** The All-time record: the bio (fresh roster) and the season history come from it. */
    career: CareerCar;
    /** The selected season's record, for its partners; absent when the car has no data that season. */
    car: Car | undefined;
}) {
    const info = GROUPS[group];
    const v = career.vehicle;
    // Partners are per season; the career record has none, so All-time leaves them out.
    const seasonCar = season === CAREER ? undefined : car;
    const mate = info.mode === 'rail' && seasonCar ? marriedMate(seasonCar) : null;
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
                            !!v.retired && `Retired ${v.retired}`,
                            v.fleet_label || 'Unknown fleet',
                            !!career.new_delivery &&
                                !!career.first_seen &&
                                `In service since: ${fmtDate(career.first_seen)}`,
                            !!career.last_seen && `Last seen: ${fmtDate(career.last_seen)}`,
                        ]}
                    />
                </p>
            </div>

            <SeasonTable career={career} group={group} />

            {seasonCar && (
                <div className="min-w-0 px-[18px] pt-3 pb-5">
                    <h3 className="text-lead mt-1.5 mb-2.5 font-bold">
                        <StatTerm id={info.partner.stat} />
                    </h3>
                    <PartnerTable car={seasonCar} group={group} season={season} compact />
                </div>
            )}
        </section>
    );
}

// Tighter cell padding under 320px, where even the columns that remain would not quite fit.
const th =
    'border-ink-2 border-b px-1 py-2 text-right font-bold whitespace-nowrap first:text-left @max-[20rem]:px-0.5';

const td = 'px-1 py-[7px] text-right whitespace-nowrap first:text-left @max-[20rem]:px-0.5';
const total = `${td} border-panel-line border-t`;

// Columns drop out as the table narrows (the card is narrow on phones and in the two- and
// three-column layouts), so the rest fit without a hidden horizontal scroll; the percentile panel
// still shows both. Miles goes under 400px; On-Sched and Streak under 312px (the
// narrowest phones), leaving Saved/trip and TAR.
const NARROW_HIDE = '@max-[25rem]:hidden';
const NARROWEST_HIDE = '@max-[19.5rem]:hidden';

const link = 'text-brand underline';

/** The TAR cell, tinted by its percentile as on the leaderboard. */
function TarCell({
    tar,
    pct,
    className,
}: {
    tar: number | null;
    pct: number | null;
    className: string;
}) {
    return (
        <td
            className={className}
            style={pct == null ? undefined : { background: tint(pctColor(pct)) }}
        >
            {fmtTrips(tar)}
        </td>
    );
}

/**
 * One row per season from the career file, newest first, plus the All-time record. Each season
 * links to that season of the page. Saved/trip is seconds in a season and a percentage All-time,
 * since each season is compared with its own year.
 */
function SeasonTable({ career, group }: { career: CareerCar; group: GroupId }) {
    if (!career.seasons.length) return null;
    const { showMiles } = GROUPS[group];

    return (
        <div className="@container mx-3.5 mt-[18px] mb-2 overflow-x-auto">
            <table className="text-meta w-full border-collapse" aria-label="Seasons">
                <thead>
                    <tr>
                        <th className={th}>Season</th>
                        <th className={th}>Trips</th>
                        {showMiles && <th className={`${th} ${NARROW_HIDE}`}>Miles</th>}
                        <th className={th}>Saved/trip</th>
                        <th className={`${th} ${NARROWEST_HIDE}`}>On-Sched</th>
                        <th className={th}>TAR</th>
                        <th className={`${th} leading-tight whitespace-normal! ${NARROWEST_HIDE}`}>
                            Streak
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {career.seasons.map((s) => (
                        <tr key={s.season}>
                            <td className={td}>
                                <Link
                                    to="."
                                    search={(prev) => ({ ...prev, season: s.season })}
                                    className={link}
                                >
                                    {seasonLabel(s.season)}
                                </Link>
                            </td>
                            <td className={td}>{fmtInt(s.trips)}</td>
                            {showMiles && (
                                <td className={`${td} ${NARROW_HIDE}`}>{fmtInt(s.miles)}</td>
                            )}
                            <td className={td}>{fmtSaved(timeSaved(s))}</td>
                            <td className={`${td} ${NARROWEST_HIDE}`}>
                                {fmtNum(s.on_time_pct, 1, '%')}
                            </td>
                            <TarCell tar={s.tar} pct={s.pct_tar} className={td} />
                            <td className={`${td} ${NARROWEST_HIDE}`}>
                                {s.iron_horse_days ?? '–'}
                            </td>
                        </tr>
                    ))}
                    <tr className="bg-wash font-bold">
                        <td className={total}>
                            <Link
                                to="."
                                search={(prev) => ({ ...prev, season: CAREER })}
                                className={link}
                            >
                                {seasonLabel(CAREER)}
                            </Link>
                        </td>
                        <td className={total}>{fmtInt(career.trips)}</td>
                        {showMiles && (
                            <td className={`${total} ${NARROW_HIDE}`}>{fmtInt(career.miles)}</td>
                        )}
                        <td className={total}>{fmtSavedPct(savedPct(career))}</td>
                        <td className={`${total} ${NARROWEST_HIDE}`}>
                            {fmtNum(career.on_time_pct, 1, '%')}
                        </td>
                        <TarCell tar={career.tar ?? null} pct={career.pct.tar} className={total} />
                        <td className={`${total} ${NARROWEST_HIDE}`}>
                            {career.iron_horse_days ?? '–'}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}
