import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { routeTree } from './routeTree.gen';
import { parseSearch, stringifySearch } from './search';

const HOUR = 60 * 60 * 1000;

// Data is rebuilt nightly, so an hour-old copy is fresh enough; keep it cached at least that long.
const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: HOUR, gcTime: 2 * HOUR } },
});

const router = createRouter({
    routeTree,
    defaultPreload: 'intent',
    parseSearch,
    stringifySearch,
});

declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router;
    }
}

const root = document.getElementById('root');

if (root)
    createRoot(root).render(
        <StrictMode>
            <QueryClientProvider client={queryClient}>
                <RouterProvider router={router} />
            </QueryClientProvider>
        </StrictMode>
    );
