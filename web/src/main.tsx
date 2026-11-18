import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    createRouter,
    parseSearchWith,
    RouterProvider,
    stringifySearchWith,
} from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { routeTree } from './routeTree.gen';

const HOUR = 60 * 60 * 1000;

// Data is rebuilt nightly, so an hour-old copy is fresh enough; keep it cached at least that long.
const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: HOUR, gcTime: 2 * HOUR } },
});

const router = createRouter({
    routeTree,
    defaultPreload: 'intent',
    // Search values stay plain strings (`?season=2026`, not JSON-decoded to a number), so each
    // route's validateSearch sees exactly what's in the URL and links need no casts.
    parseSearch: parseSearchWith((v) => v),
    stringifySearch: stringifySearchWith(String),
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
