import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
    component: () => <p className="text-ink-2 py-10 text-xl">Home (coming in F3).</p>,
});
