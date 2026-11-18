/** Loading text; a page-level block by default, or `inline` inside a section. */
export default function Loading({ inline = false }: { inline?: boolean }) {
    return (
        <p
            role="status"
            className={inline ? 'text-ink-2 text-xl' : 'text-ink-2 py-16 text-center text-xl'}
        >
            Loading…
        </p>
    );
}
