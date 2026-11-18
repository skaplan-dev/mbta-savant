import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useMemo } from 'react';
import type { FleetsFile } from '../../api';
import LineDot from '../../components/LineDot';
import ResourceView from '../../components/ResourceView';
import SeasonBar from '../../components/SeasonBar';
import { useDocumentTitle } from '../../components/useDocumentTitle';
import { fmtInt } from '../../format';
import { GROUPS, type GroupId } from '../../groups';
import { fleetsQuery } from '../../queries';
import { UNRANKED_LINE_NOTE } from '../../rank';
import { seasonLabel } from '../../seasons';
import { lineTitle } from '../../titles';
import FleetStrip from './FleetStrip';
import LeaderboardTable from './LeaderboardTable';
import { splitCars } from './leaderboard';
import NotRanked from './NotRanked';
import { useLineData, type LineData } from './useLineData';

const route = getRouteApi('/line/$group');

export default function LinePage() {
    const { group } = route.useParams();

    return <LineLoader key={group} group={group} />;
}

function LineLoader({ group }: { group: GroupId }) {
    const { season } = route.useSearch();
    const resource = useLineData(group, season);

    return (
        <ResourceView resource={resource}>
            {(data) => <LineView group={group} data={data} />}
        </ResourceView>
    );
}

/** Fleets largest first. */
const fleetList = (fleets: FleetsFile | null, season: string) =>
    Object.values(fleets?.[season] ?? {}).sort((a, b) => b.cars - a.cars);

function LineView({
    group,
    data: { meta, windows, season, file },
}: {
    group: GroupId;
    data: LineData;
}) {
    const { ranked, unranked } = useMemo(() => splitCars(group, file), [group, file]);

    const { data: fleets = [] } = useQuery({
        ...fleetsQuery(group),
        select: (f) => fleetList(f, season),
    });

    useDocumentTitle(lineTitle(season, group));

    return (
        <main>
            <SeasonBar
                latest={meta.latest_service_date}
                options={windows}
                value={season}
                className="mt-2 mb-[26px]"
            />
            <h1 className="m-0 text-[34px] font-medium tracking-tight md:text-[46px]">
                <LineDot group={group} className="mr-3 inline-block size-[18px] align-middle" />
                {seasonLabel(season)} {GROUPS[group].name} Leaderboard
            </h1>
            <p className="text-ink-2 mt-1.5 mb-6 text-lg md:text-xl">
                {GROUPS[group].ranked
                    ? `${fmtInt(ranked.length)} ranked cars. Click a column to sort; cars need ${fmtInt(file.qualify_min_trips)} trips to qualify.`
                    : UNRANKED_LINE_NOTE}
            </p>
            {fleets.length > 0 && <FleetStrip fleets={fleets} />}
            {ranked.length > 0 && (
                <LeaderboardTable group={group} season={season} ranked={ranked} />
            )}
            {unranked.length > 0 && <NotRanked group={group} season={season} rows={unranked} />}
        </main>
    );
}
