import { getRouteApi } from '@tanstack/react-router';
import { useMemo } from 'react';
import type { FleetsFile } from '../../api';
import LineDot from '../../components/LineDot';
import ResourceView from '../../components/ResourceView';
import SeasonBar from '../../components/SeasonBar';
import { useDocumentTitle } from '../../components/useDocumentTitle';
import { fmtInt } from '../../format';
import { GROUPS, type GroupId } from '../../groups';
import { UNRANKED_LINE_NOTE } from '../../rank';
import { seasonLabel } from '../../seasons';
import { lineTitle } from '../../titles';
import FleetStrip from './FleetStrip';
import LeaderboardTable from './LeaderboardTable';
import { splitCars } from './leaderboard';
import NotRanked from './NotRanked';
import RoutePicker from '../route/RoutePicker';
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

const fleetList = (fleets: FleetsFile | null, season: string) =>
    Object.values(fleets?.[season] ?? {}).sort((a, b) => b.cars - a.cars);

function LineView({
    group,
    data: { meta, windows, season, file, fleets: fleetsFile },
}: {
    group: GroupId;
    data: LineData;
}) {
    const { ranked, unranked } = useMemo(() => splitCars(group, file), [group, file]);

    const fleets = useMemo(() => fleetList(fleetsFile, season), [fleetsFile, season]);

    useDocumentTitle(lineTitle(season, group));

    return (
        <main>
            <SeasonBar
                latest={meta.latest_service_date}
                options={windows}
                value={season}
                className="mt-2 mb-[26px]"
            />
            <h1 className="text-title m-0 font-medium">
                <LineDot group={group} className="mr-3 inline-block size-[18px] align-middle" />
                {seasonLabel(season)} {GROUPS[group].name} Leaderboard
            </h1>
            <p className="text-ink-2 text-ui md:text-lead mt-1.5 mb-6">
                {GROUPS[group].ranked
                    ? `${fmtInt(ranked.length)} ranked cars. Cars need ${fmtInt(file.qualify_min_trips)} trips to qualify.`
                    : UNRANKED_LINE_NOTE}
            </p>
            {group === 'bus' && <RoutePicker season={season} />}
            {fleets.length > 0 && <FleetStrip fleets={fleets} />}
            {ranked.length > 0 && (
                <LeaderboardTable
                    group={group}
                    season={season}
                    ranked={ranked}
                    tooClose={file.too_close}
                />
            )}
            {unranked.length > 0 && <NotRanked group={group} season={season} rows={unranked} />}
        </main>
    );
}
