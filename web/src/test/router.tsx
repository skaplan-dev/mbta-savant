import { render } from '@testing-library/react';
import {
    createMemoryHistory,
    createRootRoute,
    createRouter,
    RouterProvider,
} from '@tanstack/react-router';
import type { ReactNode } from 'react';

/** Renders `ui` inside a real in-memory router, so Links work as they do in the app. */
export async function renderWithRouter(ui: ReactNode) {
    const router = createRouter({
        routeTree: createRootRoute({ component: () => ui }),
        history: createMemoryHistory({ initialEntries: ['/'] }),
    });

    await router.load();

    return render(<RouterProvider router={router} />);
}
