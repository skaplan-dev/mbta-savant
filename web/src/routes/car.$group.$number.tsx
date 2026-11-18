import { createFileRoute, notFound } from '@tanstack/react-router';
import CarPage from '../features/car/CarPage';
import { isGroup } from '../format';
import { validateSeasonSearch } from '../search';

export const Route = createFileRoute('/car/$group/$number')({
    validateSearch: validateSeasonSearch,
    beforeLoad: ({ params }) => {
        if (!isGroup(params.group)) throw notFound();
    },
    component: CarRoute,
});

function CarRoute() {
    const { group, number } = Route.useParams();
    const { season } = Route.useSearch();

    if (!isGroup(group)) return null;

    return <CarPage key={`${group}/${number}`} group={group} number={number} season={season} />;
}
