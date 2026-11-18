import { createFileRoute } from '@tanstack/react-router';
import LinePage from '../features/line/LinePage';
import { parseGroup } from '../groups';
import { validateSeasonSearch } from '../seasons';

export const Route = createFileRoute('/line/$group')({
    params: {
        parse: ({ group }) => ({ group: parseGroup(group) }),
        stringify: ({ group }) => ({ group }),
    },
    validateSearch: validateSeasonSearch,
    component: LinePage,
});
