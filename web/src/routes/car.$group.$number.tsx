import { createFileRoute, notFound } from '@tanstack/react-router';
import CarPage from '../CarPage';
import { isGroup } from '../format';
import { defaultWindow, useMeta } from '../queries';
import { validateSeasonSearch } from '../search';

export const Route = createFileRoute('/car/$group/$number')({
    validateSearch: validateSeasonSearch,
    beforeLoad: ({ params }) => {
        if (!isGroup(params.group)) throw notFound();
    },
    component: CarPlaceholder,
});

// Placeholder until F2 replaces it with the real car page.
function CarPlaceholder() {
    const { group, number } = Route.useParams();
    const { season } = Route.useSearch();
    const { data: meta } = useMeta();
    const window = season ?? defaultWindow(meta);
    return window ? <CarPage window={window} carId={`${group}:${number}`} /> : null;
}
