"use client";

interface Props {
  score: number;
  delta?: number;
  confidence?: string;
}

function scoreColor(score: number): string {
  if (score >= 76) return "#E8593C";
  if (score >= 56) return "#EF9F27";
  if (score >= 31) return "#378ADD";
  return "#1D9E75";
}

function scoreLabel(score: number): string {
  if (score >= 76) return "Danger";
  if (score >= 56) return "High";
  if (score >= 31) return "Medium";
  return "Low";
}

export default function RiskDial({ score, delta, confidence }: Props) {
  const color = scoreColor(score);
  const label = scoreLabel(score);

  // SVG arc parameters
  const r = 70;
  const cx = 100;
  const cy = 100;
  const startAngle = -220;
  const endAngle = 40;
  const totalAngle = endAngle - startAngle; // 260deg sweep

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  function arcPath(pct: number) {
    const sweep = (pct / 100) * totalAngle;
    const end = startAngle + sweep;
    const x1 = cx + r * Math.cos(toRad(startAngle));
    const y1 = cy + r * Math.sin(toRad(startAngle));
    const x2 = cx + r * Math.cos(toRad(end));
    const y2 = cy + r * Math.sin(toRad(end));
    const largeArc = sweep > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  }

  return (
    <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-2"
      style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
        Today&apos;s Risk
      </h2>
      <svg viewBox="0 0 200 140" className="w-48 h-36">
        {/* Background track */}
        <path
          d={arcPath(100)}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={14}
          strokeLinecap="round"
        />
        {/* Score arc */}
        <path
          d={arcPath(score)}
          fill="none"
          stroke={color}
          strokeWidth={14}
          strokeLinecap="round"
        />
        {/* Score number */}
        <text
          x={cx}
          y={cy + 8}
          textAnchor="middle"
          fontSize={38}
          fontWeight="700"
          fill={color}
          fontFamily="var(--font-dm-mono)"
        >
          {score}
        </text>
        {/* Label */}
        <text
          x={cx}
          y={cy + 28}
          textAnchor="middle"
          fontSize={12}
          fill="#6B7280"
          fontFamily="var(--font-dm-sans)"
        >
          {label}
        </text>
      </svg>

      <div className="flex items-center gap-2">
        {delta !== undefined && (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: delta > 0 ? "#FEE2E2" : "#DCFCE7",
              color: delta > 0 ? "#B91C1C" : "#15803D",
              fontFamily: "var(--font-dm-mono)",
            }}
          >
            {delta > 0 ? `+${delta}` : delta}
          </span>
        )}
        {confidence && (
          <span className="text-xs text-gray-400">{confidence} confidence</span>
        )}
      </div>
    </div>
  );
}
