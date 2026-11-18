export default function Loading({ inline = false }: { inline?: boolean }) {
    const text = (
        <p
            role="status"
            className={inline ? 'text-ink-2 text-lead' : 'text-ink-2 text-lead py-16 text-center'}
        >
            Loading…
        </p>
    );

    return inline ? text : <main className="min-h-screen">{text}</main>;
}
