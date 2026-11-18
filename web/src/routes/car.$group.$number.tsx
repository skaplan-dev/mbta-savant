import { createFileRoute } from '@tanstack/react-router';
import CarPage from '../features/car/CarPage';
import { parseGroup } from '../groups';
import { validateSeasonSearch, type SeasonSearch } from '../seasons';

interface CarSearch extends SeasonSearch {
    /** The lower tab; Game Log when absent. */
    tab?: 'mates';
}

function validateCarSearch({ season, tab }: CarSearch): CarSearch {
    const search = validateSeasonSearch({ season });

    return tab === 'mates' ? { ...search, tab } : search;
}

export const Route = createFileRoute('/car/$group/$number')({
    params: {
        parse: ({ group, number }) => ({ group: parseGroup(group), number }),
        stringify: ({ group, number }) => ({ group, number }),
    },
    validateSearch: validateCarSearch,
    component: CarPage,
});
