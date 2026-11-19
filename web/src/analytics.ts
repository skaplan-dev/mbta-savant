// GoatCounter (count.js in index.html) counts the first page load itself, using the page's canonical URL.
// Moving between pages inside the app doesn't reload the page, so those views are reported here. Only path
// changes count: switching the season (?season=) on the same page is not a new view.

declare global {
    interface Window {
        goatcounter?: { count: (vars: { path: string }) => void };
    }
}

export interface Resolved {
    fromLocation?: { pathname: string };
    toLocation: { pathname: string };
    pathChanged: boolean;
}

/** The one router method used here; the app passes its TanStack router. */
export interface NavigationSource {
    subscribe: (event: 'onResolved', listener: (e: Resolved) => void) => () => void;
}

export const trackPageViews = (router: NavigationSource) =>
    router.subscribe('onResolved', ({ fromLocation, toLocation, pathChanged }) => {
        if (fromLocation && pathChanged) window.goatcounter?.count({ path: toLocation.pathname });
    });
