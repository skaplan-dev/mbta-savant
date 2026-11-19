import { createFileRoute } from '@tanstack/react-router';
import RoutePage from '../features/route/RoutePage';
import { validateSeasonSearch } from '../seasons';

export const Route = createFileRoute('/route/$route')({
    validateSearch: validateSeasonSearch,
    component: RoutePage,
});
