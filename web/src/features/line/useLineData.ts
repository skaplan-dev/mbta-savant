import { useQuery } from '@tanstack/react-query';
import type { FleetsFile, GroupFile, Meta } from '../../api';
import type { GroupId } from '../../groups';
import { fleetsQuery, groupQuery, useWindows } from '../../queries';
import { failure, type Resource } from '../../resource';
import { defaultWindow, resolveSeason } from '../../seasons';

export interface LineData {
    meta: Meta;
    windows: string[];
    season: string;
    file: GroupFile;
    fleets: FleetsFile | null;
}

export function useLineData(group: GroupId, requested: string | undefined): Resource<LineData> {
    const { meta, windows } = useWindows();

    // The requested season if it exists, else the line's default (newest year with a ranked car), which the
    // pipeline works out so this page needn't load every car in every window.
    const season = meta.data
        ? (resolveSeason(requested, windows) ?? meta.data.default_season?.[group] ?? defaultWindow(windows))
        : undefined;

    const file = useQuery(groupQuery(season, group));
    const fleets = useQuery(fleetsQuery(group));

    if (meta.isPending || fleets.isPending || (season && file.isPending))
        return { status: 'loading' };

    const failed = failure(meta, file);

    if (failed) return failed;

    if (!meta.data || !season || !file.data) return { status: 'missing' };

    return {
        status: 'ready',
        data: { meta: meta.data, windows, season, file: file.data, fleets: fleets.data ?? null },
    };
}
