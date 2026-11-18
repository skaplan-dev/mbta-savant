import { createFileRoute, notFound } from '@tanstack/react-router';
import Leaderboard from '../Leaderboard';
import { isGroup } from '../format';
import { defaultWindow, useMeta } from '../queries';
import { validateSeasonSearch } from '../search';

export const Route = createFileRoute('/line/$group')({
    validateSearch: validateSeasonSearch,
    beforeLoad: ({ params }) => {
        if (!isGroup(params.group)) throw notFound();
    },
    component: LinePlaceholder,
});

// Placeholder until F3 replaces it with the real leaderboard.
function LinePlaceholder() {
    const { group } = Route.useParams();
    const { season } = Route.useSearch();
    const { data: meta } = useMeta();
    const window = season ?? defaultWindow(meta);
    return window ? <Leaderboard window={window} group={group} /> : null;
}
