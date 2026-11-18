import type { ReactNode } from 'react';
import { GROUPS, type ArtKind, type GroupId } from '../../groups';

// Hero art: side elevations drawn in the line color. All share a 640×130 viewBox so the hero
// frames them the same way.

const STROKE = '#8a979b';
const GLASS = '#33454c';
const BODY = '#f4f6f7';

function Wheel({ cx, cy = 116, r = 11 }: { cx: number; cy?: number; r?: number }) {
    return (
        <>
            <circle cx={cx} cy={cy} r={r} fill="#3b464a" />
            <circle cx={cx} cy={cy} r={r * 0.36} fill="#9aa5a9" />
        </>
    );
}

function Label({ x, y, n }: { x: number; y: number; n: string }) {
    return (
        <text
            x={x}
            y={y}
            textAnchor="middle"
            fontSize="15"
            fontWeight="700"
            fill="#1d2427"
            fontFamily="Roboto Condensed, sans-serif"
        >
            {n}
        </text>
    );
}

/** Heavy-rail car (Red, Orange, Blue): the mockup's carSvg body. */
function HeavyRailCar({ x, n, color }: { x: number; n: string; color: string }) {
    return (
        <g transform={`translate(${x},0)`}>
            <rect
                x="0"
                y="20"
                width="300"
                height="88"
                rx="10"
                fill={BODY}
                stroke={STROKE}
                strokeWidth="2"
            />
            <rect x="0" y="86" width="300" height="12" fill={color} />
            <rect x="0" y="28" width="300" height="5" fill={color} opacity="0.85" />
            {[40, 130, 220].map((dx) => (
                <g key={dx}>
                    <rect
                        x={dx}
                        y="40"
                        width="34"
                        height="58"
                        rx="2"
                        fill="#cfd8db"
                        stroke={STROKE}
                        strokeWidth="1.5"
                    />
                    <line
                        x1={dx + 17}
                        y1="40"
                        x2={dx + 17}
                        y2="98"
                        stroke={STROKE}
                        strokeWidth="1.5"
                    />
                </g>
            ))}
            {[84, 174, 264].map((dx) => (
                <rect
                    key={dx}
                    x={dx - 6}
                    y="42"
                    width={dx === 264 ? 30 : 40}
                    height="26"
                    rx="3"
                    fill={GLASS}
                />
            ))}
            <rect x="6" y="42" width="24" height="26" rx="3" fill={GLASS} />
            <Label x={150} y={80} n={n} />
            {[40, 80, 220, 260].map((cx) => (
                <Wheel key={cx} cx={cx} />
            ))}
        </g>
    );
}

/** Green Line: a two-section articulated light-rail vehicle with a pantograph. */
function LightRail({ n, color }: { n: string; color: string }) {
    const section = (x: number, nose: 'l' | 'r') => (
        <g transform={`translate(${x},0)`}>
            <path
                d={
                    nose === 'l'
                        ? 'M14 30 Q2 30 0 50 L0 108 L250 108 L250 30 Z'
                        : 'M0 30 L236 30 Q248 30 250 50 L250 108 L0 108 Z'
                }
                fill={BODY}
                stroke={STROKE}
                strokeWidth="2"
            />
            <rect x="0" y="88" width="250" height="12" fill={color} />
            <rect x="0" y="36" width="250" height="4" fill={color} opacity="0.85" />
            {[60, 170].map((dx) => (
                <rect
                    key={dx}
                    x={dx}
                    y="48"
                    width="30"
                    height="52"
                    rx="2"
                    fill="#cfd8db"
                    stroke={STROKE}
                    strokeWidth="1.5"
                />
            ))}
            {[16, 100, 206].map((dx) => (
                <rect
                    key={dx}
                    x={dx}
                    y="48"
                    width={dx === 100 ? 60 : 30}
                    height="26"
                    rx="3"
                    fill={GLASS}
                />
            ))}
            <Wheel cx={45} />
            <Wheel cx={205} />
        </g>
    );

    return (
        <g>
            <path
                d="M210 30 L240 8 L280 8 M240 8 L270 30"
                stroke="#3b464a"
                strokeWidth="2.5"
                fill="none"
            />
            <line x1="170" y1="8" x2="330" y2="8" stroke="#3b464a" strokeWidth="1.5" />
            {section(55, 'l')}
            <rect x="305" y="34" width="10" height="72" fill="#5a676b" />
            {section(315, 'r')}
            <Label x={180} y={84} n={n} />
        </g>
    );
}

/** Mattapan: a PCC streetcar, rounded at both ends, trolley pole up. */
function PCC({ n, color }: { n: string; color: string }) {
    return (
        <g transform="translate(160,0)">
            <path d="M200 26 L260 2" stroke="#3b464a" strokeWidth="2.5" />
            <path
                d="M40 28 L280 28 Q318 30 320 70 L320 108 L0 108 L0 70 Q2 30 40 28 Z"
                fill={BODY}
                stroke={STROKE}
                strokeWidth="2"
            />
            <path d="M0 84 L320 84 L320 100 L0 100 Z" fill={color} />
            <rect x="4" y="40" width="312" height="4" fill={color} opacity="0.85" />
            {[30, 78, 126, 174, 222, 270].map((dx) => (
                <rect key={dx} x={dx} y="50" width="36" height="24" rx="3" fill={GLASS} />
            ))}
            <rect
                x="12"
                y="50"
                width="12"
                height="50"
                rx="2"
                fill="#cfd8db"
                stroke={STROKE}
                strokeWidth="1.5"
            />
            <Label x={160} y={97} n={n} />
            <Wheel cx={60} />
            <Wheel cx={90} />
            <Wheel cx={230} />
            <Wheel cx={260} />
        </g>
    );
}

/** Bus: a 40 ft side elevation, or a 60 ft articulated one. */
function Bus({ n, color, articulated }: { n: string; color: string; articulated: boolean }) {
    const len = articulated ? 560 : 380;
    const x0 = (640 - len) / 2 - 10;
    const windows: number[] = [];
    const joint = len * 0.6;
    const door2 = Math.round(len * 0.36);

    // Windows skip the second door and the articulation joint.
    for (let x = 70; x < len - 70; x += 46) {
        if (x + 40 > door2 - 4 && x < door2 + 32) continue;

        if (articulated && x + 40 > joint - 12 && x < joint + 12) continue;
        windows.push(x);
    }

    return (
        <g transform={`translate(${x0},0)`}>
            <path
                d={`M10 22 L${len - 6} 22 Q${len} 22 ${len} 32 L${len} 104 L0 104 L0 34 Q0 22 10 22 Z`}
                fill={BODY}
                stroke={STROKE}
                strokeWidth="2"
            />
            <rect x="0" y="80" width={len} height="12" fill={color} />
            <rect x="0" y="24" width={len} height="5" fill={color} opacity="0.9" />
            {/* front: windshield and door */}
            <rect x="4" y="34" width="22" height="40" rx="3" fill={GLASS} />
            <rect
                x="32"
                y="34"
                width="28"
                height="66"
                rx="2"
                fill="#cfd8db"
                stroke={STROKE}
                strokeWidth="1.5"
            />
            <line x1="46" y1="34" x2="46" y2="100" stroke={STROKE} strokeWidth="1.5" />
            {windows.map((x) => (
                <rect key={x} x={x} y="34" width="40" height="30" rx="3" fill={GLASS} />
            ))}
            {articulated && (
                <g>
                    <rect x={joint - 8} y="22" width="16" height="82" fill="#5a676b" />
                    {[0, 1, 2, 3].map((i) => (
                        <line
                            key={i}
                            x1={joint - 6 + i * 4}
                            y1="24"
                            x2={joint - 6 + i * 4}
                            y2="102"
                            stroke="#3b464a"
                            strokeWidth="1"
                        />
                    ))}
                </g>
            )}
            <rect
                x={door2}
                y="34"
                width="28"
                height="66"
                rx="2"
                fill="#cfd8db"
                stroke={STROKE}
                strokeWidth="1.5"
            />
            <text
                x={len - 40}
                y="76"
                textAnchor="middle"
                fontSize="15"
                fontWeight="700"
                fill="#1d2427"
                fontFamily="Roboto Condensed, sans-serif"
            >
                {n}
            </text>
            <Wheel cx={70} cy={108} r={13} />
            <Wheel cx={articulated ? joint - 40 : len - 70} cy={108} r={13} />
            {articulated && <Wheel cx={len - 60} cy={108} r={13} />}
        </g>
    );
}

const ART: Record<
    ArtKind,
    (p: { n: string; mate: string | null; color: string; lengthFt?: number }) => ReactNode
> = {
    'heavy-rail': ({ n, mate, color }) =>
        mate ? (
            <>
                <HeavyRailCar x={0} n={n} color={color} />
                <HeavyRailCar x={310} n={mate} color={color} />
            </>
        ) : (
            <HeavyRailCar x={155} n={n} color={color} />
        ),
    'light-rail': ({ n, color }) => <LightRail n={n} color={color} />,
    pcc: ({ n, color }) => <PCC n={n} color={color} />,
    bus: ({ n, color, lengthFt }) => (
        <Bus n={n} color={color} articulated={(lengthFt ?? 0) >= 60} />
    ),
};

export default function CarArt({
    group,
    number,
    mate,
    lengthFt,
}: {
    group: GroupId;
    number: string;
    mate: string | null;
    lengthFt?: number;
}) {
    const { art, color } = GROUPS[group];

    return (
        <svg
            viewBox="-10 0 640 130"
            aria-hidden="true"
            className="absolute bottom-[26%] left-1/2 h-auto w-[112%] -translate-x-1/2"
        >
            {ART[art]({ n: number, mate, color, lengthFt })}
        </svg>
    );
}
