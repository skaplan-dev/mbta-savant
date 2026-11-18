import { createFileRoute, notFound } from '@tanstack/react-router';
import LinePage from '../features/line/LinePage';
import { isGroup } from '../format';
import { validateSeasonSearch } from '../search';

export const Route = createFileRoute('/line/$group')({
    validateSearch: validateSeasonSearch,
    beforeLoad: ({ params }) => {
        if (!isGroup(params.group)) throw notFound();
    },
    component: LineRoute,
});

function LineRoute() {
    const { group } = Route.useParams();
    const { season } = Route.useSearch();

    if (!isGroup(group)) return null;

    return <LinePage key={group} group={group} season={season} />;
}
