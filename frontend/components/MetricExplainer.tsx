"use client";

interface Metric {
  key: string;
  label: string;
  fullName: string;
  value: number | null;
  unit?: string;
  description: string;
  interpret: (v: number) => { status: "good" | "warn" | "danger"; text: string };
}

const STATUS_COLORS = {
  good: { bg: "#F0FDF4", text: "#15803D", border: "#BBF7D0" },
  warn: { bg: "#FFFBEB", text: "#B45309", border: "#FDE68A" },
  danger: { bg: "#FEF2F2", text: "#B91C1C", border: "#FECACA" },
};

const METRICS: Omit<Metric, "value">[] = [
  {
    key: "acwr",
    label: "ACWR",
    fullName: "Acute:Chronic Workload Ratio",
    unit: "",
    description: "Compares your last 7 days of training to your 42-day baseline fitness. The danger zone is above 1.5.",
    interpret: (v) => {
      if (v < 0.8) return { status: "warn", text: "Under-training — below baseline" };
      if (v <= 1.3) return { status: "good", text: "In the safe zone" };
      if (v <= 1.5) return { status: "warn", text: "Elevated — approaching danger zone" };
      return { status: "danger", text: "Overloading — high injury risk" };
    },
  },
  {
    key: "atl",
    label: "ATL",
    fullName: "Acute Training Load",
    unit: " TSS",
    description: "Your 7-day exponentially weighted training stress. High ATL = high recent fatigue.",
    interpret: (v) => {
      if (v < 30) return { status: "warn", text: "Low fatigue — possibly under-training" };
      if (v < 80) return { status: "good", text: "Normal fatigue level" };
      if (v < 120) return { status: "warn", text: "High fatigue — monitor recovery" };
      return { status: "danger", text: "Very high fatigue" };
    },
  },
  {
    key: "ctl",
    label: "CTL",
    fullName: "Chronic Training Load",
    unit: " TSS",
    description: "Your 42-day fitness base. Higher CTL means you've built more aerobic capacity over time.",
    interpret: (v) => {
      if (v < 20) return { status: "warn", text: "Early base — keep building" };
      if (v < 60) return { status: "good", text: "Solid fitness base" };
      return { status: "good", text: "High fitness base — well trained" };
    },
  },
  {
    key: "tsb",
    label: "TSB",
    fullName: "Training Stress Balance",
    unit: " TSS",
    description: "CTL minus ATL — your form. Positive means fresh, negative means fatigued.",
    interpret: (v) => {
      if (v > 15) return { status: "warn", text: "Very fresh — maybe increase load" };
      if (v >= -10) return { status: "good", text: "Well balanced — good form" };
      if (v >= -30) return { status: "warn", text: "Fatigued — consider easy day" };
      return { status: "danger", text: "Very fatigued — rest recommended" };
    },
  },
  {
    key: "monotony",
    label: "Monotony",
    fullName: "Training Monotony",
    unit: "",
    description: "How repetitive your training is. High monotony = same workload every day = higher injury risk.",
    interpret: (v) => {
      if (v < 1.5) return { status: "good", text: "Good variation in training" };
      if (v < 2.0) return { status: "warn", text: "Getting repetitive" };
      return { status: "danger", text: "Too monotonous — vary intensity" };
    },
  },
  {
    key: "strain",
    label: "Strain",
    fullName: "Training Strain",
    unit: "",
    description: "Weekly load multiplied by monotony. High strain from repetitive hard training is the biggest injury predictor.",
    interpret: (v) => {
      if (v < 2000) return { status: "good", text: "Manageable strain" };
      if (v < 5000) return { status: "warn", text: "Moderate strain — watch for fatigue" };
      return { status: "danger", text: "High strain — recovery needed" };
    },
  },
];

interface Props {
  features: Record<string, number>;
}

export default function MetricExplainer({ features }: Props) {
  return (
    <div className="bg-white rounded-2xl p-6" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
        Training Metrics
      </h2>
      <div className="space-y-3">
        {METRICS.map((m) => {
          const raw = features[m.key];
          if (raw === undefined || raw === null) return null;
          const { status, text } = m.interpret(raw);
          const colors = STATUS_COLORS[status];
          const displayVal = m.key === "strain"
            ? Math.round(raw).toLocaleString()
            : raw.toFixed(m.unit === " TSS" ? 0 : 2);

          return (
            <div key={m.key} className="rounded-xl p-3 space-y-1"
              style={{ backgroundColor: colors.bg, border: `0.5px solid ${colors.border}` }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md text-white"
                    style={{ backgroundColor: colors.text }}>
                    {m.label}
                  </span>
                  <span className="text-xs text-gray-500">{m.fullName}</span>
                </div>
                <span className="text-sm font-bold" style={{ color: colors.text, fontFamily: "var(--font-dm-mono)" }}>
                  {displayVal}{m.unit}
                </span>
              </div>
              <p className="text-xs font-medium" style={{ color: colors.text }}>{text}</p>
              <p className="text-xs text-gray-500">{m.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
