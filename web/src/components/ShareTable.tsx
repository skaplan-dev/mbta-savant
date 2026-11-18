import type { ReactNode } from 'react';
import { barEdge, fmtInt, pctOf } from '../format';
import { GROW, useGrowIn } from './useGrowIn';

export function ShareBar({ frac, color }: { frac: number; color: string }) {
    const grown = useGrowIn();

    return (
        <div
            className={`h-3.5 rounded-r-[7px] transition-[width] ${GROW}`}
            style={{
                width: grown ? `${Math.max(6, frac * 100)}%` : 0,
                background: `color-mix(in srgb, ${color} 70%, white)`,
                border: `1px solid ${barEdge(color)}`,
            }}
        />
    );
}

export interface ShareRow {
    key: string;
    label: ReactNode;
    count: number;
}

const FULL = {
    table: 'mb-8 w-full border-collapse text-ui',
    th: 'border-ink-2 border-b px-2.5 py-2.5 text-right font-bold first:text-left',
    barTh: 'w-1/2 text-left!',
    td: 'border-b border-table-rule px-2.5 py-2 text-right first:text-left',
    barTd: '',
    shareTh: '',
    row: 'hover:[&>td]:bg-wash',
};

const COMPACT = {
    table: 'w-full border-collapse text-ui',
    th: 'px-1 pb-1.5 text-left text-meta font-bold',
    barTh: '',
    td: 'px-1 py-[3px]',
    barTd: 'w-full',
    shareTh: 'text-right',
    row: undefined,
};

/**
 * Rows sized by `count` (bars relative to the first, largest row) with each row's share of `total`.
 * The compact form drops the count column. `headers` are [label, bar, count].
 */
export default function ShareTable({
    rows,
    total,
    color,
    headers,
    compact = false,
}: {
    rows: ShareRow[];
    total: number;
    color: string;
    headers: [string, string, string];
    compact?: boolean;
}) {
    const s = compact ? COMPACT : FULL;
    const max = rows[0]?.count ?? 1;
    const [label, bar, count] = headers;

    return (
        <table className={s.table}>
            <thead>
                <tr>
                    <th className={s.th}>{label}</th>
                    <th className={`${s.th} ${s.barTh}`}>{bar}</th>
                    {!compact && <th className={s.th}>{count}</th>}
                    <th className={`${s.th} ${s.shareTh}`}>Share</th>
                </tr>
            </thead>
            <tbody>
                {rows.map((r) => (
                    <tr key={r.key} className={s.row}>
                        <td className={s.td}>{r.label}</td>
                        <td className={`${s.td} ${s.barTd}`}>
                            <ShareBar frac={r.count / max} color={color} />
                        </td>
                        {!compact && <td className={s.td}>{fmtInt(r.count)}</td>}
                        <td className={`${s.td} ${compact ? 'text-right' : ''}`}>
                            {pctOf(r.count, total)}%
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
