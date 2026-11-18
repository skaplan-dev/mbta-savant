import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/glossary')({
    component: () => <p className="text-ink-2 py-10 text-xl">Glossary (coming in F3).</p>,
});
