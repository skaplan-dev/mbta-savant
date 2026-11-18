import type { ReactNode } from 'react';
import { GLOSSARY, HOW_RANKINGS, LEDE, type GlossaryEntry, type StatId } from '../../glossary';

const ids = Object.keys(GLOSSARY) as StatId[];
const inSection = (s: GlossaryEntry['section']) => ids.filter((id) => GLOSSARY[id].section === s);

const SECTIONS: { key: GlossaryEntry['section']; title: string; icon?: ReactNode }[] = [
    {
        key: 'performance',
        title: 'Performance',
        icon: (
            <svg viewBox="0 0 40 40" aria-hidden="true" className="size-[34px]">
                <circle cx="20" cy="23" r="13" fill="none" stroke="#1d2427" strokeWidth="3.5" />
                <path d="M20 23 L20 14" stroke="#1d2427" strokeWidth="3.5" strokeLinecap="round" />
                <rect x="16" y="4" width="8" height="5" fill="#1d2427" />
            </svg>
        ),
    },
    {
        key: 'workload',
        title: 'Workload',
        icon: (
            <svg viewBox="0 0 40 40" aria-hidden="true" className="size-[34px]">
                <rect
                    x="5"
                    y="8"
                    width="30"
                    height="27"
                    rx="2"
                    fill="none"
                    stroke="#1d2427"
                    strokeWidth="3.5"
                />
                <path d="M5 16 H35" stroke="#1d2427" strokeWidth="3.5" />
                <path
                    d="M12 4 V11 M28 4 V11"
                    stroke="#1d2427"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                />
            </svg>
        ),
    },
    { key: 'fun', title: 'Fun facts (not ranked)' },
];

const tocH = 'text-ink-3 mt-[18px] mb-1.5 text-[15px] font-medium tracking-[0.08em]';
const tocA =
    'text-ink hover:text-brand hover:border-brand-2 block border-l-2 border-transparent py-1 pl-3 no-underline';

export default function GlossaryPage() {
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
                        <h2 className={tocH}>
                            {s.key === 'fun' ? 'FUN FACTS' : s.title.toUpperCase()}
                        </h2>
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
                                {i === 2 && <ScaleDemo />}
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
                                <Term key={id} id={id} e={GLOSSARY[id]} />
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
        <h2 className="border-brand-2 mt-[46px] mb-1.5 flex items-center gap-3 border-b pb-2 text-[30px] font-bold">
            {icon}
            {children}
        </h2>
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
                        'linear-gradient(90deg, var(--color-poor), #c8c8c8, var(--color-great))',
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

function Term({ id, e }: { id: StatId; e: GlossaryEntry }) {
    const arrow = e.better === 'higher' ? '▲ ' : e.better === 'lower' ? '▼ ' : '';
    return (
        <div
            id={id}
            className="target:from-brand/10 grid scroll-mt-5 grid-cols-1 gap-1.5 border-b border-dashed border-[#d6e1e4] py-[22px] target:bg-gradient-to-r target:to-transparent min-[901px]:grid-cols-[220px_minmax(0,1fr)] min-[901px]:gap-7"
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
