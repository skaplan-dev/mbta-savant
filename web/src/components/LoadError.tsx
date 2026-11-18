/** Shown when a data request failed (network or parse error), as opposed to a file that doesn't exist. */
export default function LoadError({ onRetry }: { onRetry: () => void }) {
    return (
        <main role="alert" className="py-16 text-center md:py-20">
            <h1 className="text-title m-0 font-medium">Couldn&rsquo;t load data</h1>
            <p className="text-ink-2 text-lead mx-auto mt-3 mb-7 max-w-[52ch]">
                Something went wrong fetching this page&rsquo;s data. Check your connection and try
                again.
            </p>
            <button
                type="button"
                onClick={onRetry}
                className="bg-brand text-lead cursor-pointer rounded-md border-0 px-6 py-3 text-white"
            >
                Try again
            </button>
        </main>
    );
}
