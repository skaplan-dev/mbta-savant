import { useQuery } from '@tanstack/react-query';
import type { FleetsFile, GroupFile, Meta } from '../../api';
import type { GroupId } from '../../groups';
import { fleetsQuery, groupQuery, useAllIndexes, useWindows } from '../../queries';
import { lineSeason } from '../../rank';
import { failure, type Resource } from '../../resource';

export interface LineData {
    meta: Meta;
    windows: string[];
    season: string;
    file: GroupFile;
    fleets: FleetsFile | null;
}

export function useLineData(group: GroupId, requested: string | undefined): Resource<LineData> {
    const { meta, windows } = useWindows();
    // Every window's index is only needed to pick a default season.
    const needDefault = !(requested && windows.includes(requested));
    const all = useAllIndexes(needDefault);

    const season =
        meta.data && !(needDefault && all.loading)
            ? lineSeason(group, requested, windows, all.indexes)
            : undefined;

    const file = useQuery(groupQuery(season, group));
    const fleets = useQuery(fleetsQuery(group));

    if (meta.isPending || fleets.isPending || (meta.data && (!season || file.isPending)))
        return { status: 'loading' };

    const failed = failure(meta, file);

    if (failed) return failed;

    if (!meta.data || !season || !file.data) return { status: 'missing' };

    return {
        status: 'ready',
        data: { meta: meta.data, windows, season, file: file.data, fleets: fleets.data ?? null },
    };
}
