/** A page's data: still loading, failed (retryable), absent (404), or ready to render. */
export type Resource<T> =
    | { status: 'loading' }
    | { status: 'error'; retry: () => void }
    | { status: 'missing' }
    | { status: 'ready'; data: T };

interface Refetchable {
    isError: boolean;
    refetch: () => void;
}

/** An error state that retries every failed query, or null when none failed. */
export function failure(...queries: Refetchable[]): Resource<never> | null {
    const failed = queries.filter((q) => q.isError);

    if (!failed.length) return null;

    return { status: 'error', retry: () => failed.forEach((q) => q.refetch()) };
}
