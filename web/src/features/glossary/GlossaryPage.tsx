import { useRouterState } from '@tanstack/react-router';
import { useEffect, type ReactNode } from 'react';
import { useDocumentTitle } from '../../components/useDocumentTitle';
import { CalendarIcon, StopwatchIcon } from '../../components/icons';
import SectionHeading from '../../components/SectionHeading';
import {
    GLOSSARY,
    HOW_RANKINGS,
    LEDE,
    STAT_IDS,
    type GlossaryEntry,
    type StatId,
} from '../../glossary';
import { GLOSSARY_TITLE } from '../../titles';

type Section = GlossaryEntry['section'];

const inSection = (s: Section) => STAT_IDS.filter((id) => GLOSSARY[id].section === s);

const SECTIONS: { key: Section; title: string; toc: string; icon?: ReactNode }[] = [
    {
        key: 'performance',
        title: 'Performance',
        toc: 'PERFORMANCE',
        icon: <StopwatchIcon className="size-[34px]" />,
    },
    {
        key: 'workload',
        title: 'Workload',
        toc: 'WORKLOAD',
        icon: <CalendarIcon className="size-[34px]" />,
    },
    { key: 'fun', title: 'Fun facts (not ranked)', toc: 'FUN FACTS' },
];

const tocH = 'text-ink-3 mt-[18px] mb-1.5 text-[15px] font-medium tracking-[0.08em]';

const tocA =
    'text-ink hover:text-brand hover:border-brand-2 block border-l-2 border-transparent py-1 pl-3 no-underline';

export default function GlossaryPage() {
    useDocumentTitle(GLOSSARY_TITLE);
    const hash = useRouterState({ select: (s) => s.location.hash });
    // Scroll to and focus the linked term on a fresh load and on in-app navigation.
    useEffect(() => {
        if (!hash) return;
        const el = document.getElementById(hash);

        if (!el) return;
        el.scrollIntoView({ block: 'start' });
        el.focus({ preventScroll: true });
    }, [hash]);

    return (
        <div className="mt-7 mb-[60px] grid grid-cols-1 gap-12 min-[901px]:grid-cols-[240px_minmax(0,1fr)]">
            <aside
                aria-label="On this page"
                className="sticky top-5 hidden self-start text-lg min-[901px]:block"
            >
                <h2 className={`${tocH} !mt-0`}>BASICS</h2>
                <a className={tocA} href="#rankings">
                    How rankings work
                </a>
                {SECTIONS.map((s) => (
                    <div key={s.key}>
                        <h2 className={tocH}>{s.toc}</h2>
                        {inSection(s.key).map((id) => (
                            <a key={id} className={tocA} href={`#${id}`}>
                                {GLOSSARY[id].name}
                            </a>
                        ))}
                    </div>
                ))}
            </aside>
            <main>
                <h1 className="m-0 mb-2.5 text-[38px] font-medium tracking-[-0.01em] md:text-[46px]">
                    Stat Glossary
                </h1>
                <p className="text-ink-2 m-0 mb-[26px] max-w-[64ch] text-[21px] leading-[1.45]">
                    {LEDE}
                </p>
                <section id="rankings" className="scroll-mt-5">
                    <H2>How rankings work</H2>
                    <div className="max-w-[70ch] text-[19px] leading-[1.5]">
                        {HOW_RANKINGS.map((p, i) => (
                            <div key={i}>
                                {p.scale && <ScaleDemo />}
                                <p className="my-3">
                                    {p.lead && <strong>{p.lead} </strong>}
                                    {p.body}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>
                {SECTIONS.map((s) => (
                    <section key={s.key}>
                        <H2 icon={s.icon}>{s.title}</H2>
                        <dl className="m-0">
                            {inSection(s.key).map((id) => (
                                <Term key={id} id={id} e={GLOSSARY[id]} active={hash === id} />
                            ))}
                        </dl>
                    </section>
                ))}
            </main>
        </div>
    );
}

function H2({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
    return (
        <SectionHeading className="mt-[46px] mb-1.5 flex items-center gap-3 text-[30px]">
            {icon}
            {children}
        </SectionHeading>
    );
}

function ScaleDemo() {
    const bubble = (left: string, bg: string, n: string) => (
        <span
            className="absolute top-1/2 -mt-[15px] -ml-[15px] grid size-[30px] place-items-center rounded-full border-[2.5px] border-white text-sm font-bold text-white shadow-[0_1px_3px_rgb(0_0_0/0.25)]"
            style={{ left, background: bg }}
        >
            {n}
        </span>
    );

    return (
        <div aria-hidden="true" className="mt-[18px] mb-1.5 flex items-center gap-3.5 text-[17px]">
            <span>POOR</span>
            <span
                className="relative h-3.5 flex-[0_1_360px] rounded-[7px]"
                style={{
                    background:
                        'linear-gradient(90deg, var(--color-poor), var(--color-scale-mid), var(--color-great))',
                }}
            >
                {bubble('6%', 'var(--color-poor)', '5')}
                {bubble('50%', '#bdbdbd', '50')}
                {bubble('94%', 'var(--color-great)', '95')}
            </span>
            <span>GREAT</span>
        </div>
    );
}

function Term({ id, e, active }: { id: StatId; e: GlossaryEntry; active: boolean }) {
    const arrow = e.better === 'higher' ? '▲ ' : e.better === 'lower' ? '▼ ' : '';

    return (
        <div
            id={id}
            tabIndex={-1}
            className={`border-row-rule grid scroll-mt-5 grid-cols-1 gap-1.5 border-b border-dashed py-[22px] outline-none ${active ? 'from-brand/10 bg-gradient-to-r to-transparent' : ''} min-[901px]:grid-cols-[220px_minmax(0,1fr)] min-[901px]:gap-7`}
        >
            <dt className="text-[25px] font-medium">
                {e.name}
                <span
                    className={`mt-2 block text-[15px] font-medium tracking-[0.04em] ${e.better === 'none' ? 'text-ink-3' : 'text-great'}`}
                >
                    {arrow}
                    {e.betterLabel}
                </span>
            </dt>
            <dd className="m-0 max-w-[68ch] text-[19px] leading-[1.5]">
                <p className="mb-2 text-[21px]">{e.lead}</p>
                {e.calc && <p className="text-ink-2 mb-2">{e.calc}</p>}
                {e.example && (
                    <span className="bg-wash text-ink-2 mt-1 inline-block rounded-full px-2.5 py-[3px] text-base">
                        {e.example}
                    </span>
                )}
            </dd>
        </div>
    );
}
