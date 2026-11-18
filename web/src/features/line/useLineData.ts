import { useQuery } from '@tanstack/react-query';
import type { GroupFile, Meta } from '../../api';
import type { GroupId } from '../../groups';
import { groupQuery, useAllIndexes, useWindows } from '../../queries';
import { lineSeason } from '../../rank';
import { failure, type Resource } from '../../resource';

export interface LineData {
    meta: Meta;
    /** Windows for the season toggle, newest first. */
    windows: string[];
    season: string;
    file: GroupFile;
}

/** The line's season (requested, else its default) and that season's group file. */
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

    if (meta.isPending || (meta.data && (!season || file.isPending))) return { status: 'loading' };

    const failed = failure(meta, file);

    if (failed) return failed;

    if (!meta.data || !season || !file.data) return { status: 'missing' };

    return { status: 'ready', data: { meta: meta.data, windows, season, file: file.data } };
}
