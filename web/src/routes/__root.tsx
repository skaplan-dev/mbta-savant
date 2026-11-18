import { createRootRoute, Outlet } from '@tanstack/react-router';
import Footer from '../components/Footer';
import Masthead from '../components/Masthead';
import NotFound from '../components/NotFound';

export const Route = createRootRoute({
    component: () => (
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
            <Masthead />
            <Outlet />
            <Footer />
        </div>
    ),
    notFoundComponent: NotFound,
});
