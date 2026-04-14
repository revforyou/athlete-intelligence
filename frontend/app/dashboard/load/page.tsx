"use client";

import { useEffect, useState } from "react";
import { api, type TrainingLoadData } from "@/lib/api";
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from "recharts";
import { ChevronDown, ChevronRight } from "lucide-react";

// ─── Metric explainer data ─────────────────────────────────────────────────

const METRIC_EXPLAINERS = [
  {
    key: "ctl",
    label: "CTL — Chronic Training Load",
    tagline: "Your fitness base",
    formula: "42-day exponential weighted avg of daily TSS",
    good: "Steadily rising over weeks/months",
    bad: "Flat or declining for 4+ weeks",
    range: "Higher = more fit, but only meaningful relative to your own baseline",
    color: "#378ADD",
  },
  {
    key: "atl",
    label: "ATL — Acute Training Load",
    tagline: "Your current fatigue",
    formula: "7-day exponential weighted avg of daily TSS",
    good: "Within 20-30% of CTL (ACWR 0.8–1.3)",
    bad: "Spikes >50% above CTL in a week",
    range: "Expect ATL > CTL after hard blocks — that's normal adaptation",
    color: "#F87171",
  },
  {
    key: "tsb",
    label: "TSB — Training Stress Balance",
    tagline: "Your form (freshness minus fatigue)",
    formula: "CTL − ATL",
    good: "-10 to +25 (moderate fatigue to fresh)",
    bad: "< -30 (overtrained) or >30 (detraining)",
    range: "Race-ready window: TSB +5 to +25. Deep training: TSB -10 to -25.",
    color: "#8B5CF6",
  },
  {
    key: "acwr",
    label: "ACWR — Acute:Chronic Workload Ratio",
    tagline: "The injury risk signal",
    formula: "ATL ÷ CTL",
    good: "0.8–1.3 (sweet spot — building without spiking)",
    bad: "> 1.5 (high injury risk zone per sports science literature)",
    range: "Stay in 0.8–1.3 for 80% of training. Brief excursions to 1.3–1.5 are okay.",
    color: "#6366F1",
  },
  {
    key: "monotony",
    label: "Monotony",
    tagline: "How repetitive your training is",
    formula: "7-day avg TSS ÷ 7-day std dev TSS",
    good: "< 1.5 (varied days — hard/easy alternation)",
    bad: "> 2.5 (same load every day — staleness and overuse risk)",
    range: "The fix for high monotony: add deliberate rest or easy days.",
    color: "#EF9F27",
  },
  {
    key: "strain",
    label: "Strain",
    tagline: "Overall weekly training stress",
    formula: "7-day TSS total × Monotony",
    good: "Relative to your CTL — no universal threshold",
    bad: "Sudden spikes when combined with high ACWR",
    range: "Use alongside ACWR, not in isolation.",
    color: "#9CA3AF",
  },
];

function MetricCard({
  metricKey, label, tagline, formula, good, bad, range, color, value,
}: Omit<typeof METRIC_EXPLAINERS[0], "key"> & { metricKey: string; value: number | null }) {
  const decimals = ["acwr", "monotony"].includes(metricKey) ? 2 : 1;
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-xl overflow-hidden" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="w-2 h-8 rounded-full" style={{ background: color }} />
          <div className="text-left">
            <p className="text-xs font-semibold text-gray-800">{label}</p>
            <p className="text-[10px] text-gray-400">{tagline}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-gray-900" style={{ fontFamily: "var(--font-dm-mono)", color }}>
            {value !== null ? value.toFixed(decimals) : "—"}
          </span>
          {open ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-0 border-t space-y-2" style={{ borderColor: "rgba(0,0,0,0.05)" }}>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Formula</p>
              <p className="text-xs text-gray-700">{formula}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-green-600 mb-1">✓ Good range</p>
              <p className="text-xs text-gray-700">{good}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-red-500 mb-1">✗ Watch out</p>
              <p className="text-xs text-gray-700">{bad}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-blue-500 mb-1">Interpretation</p>
              <p className="text-xs text-gray-700">{range}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoadPage() {
  const [data, setData] = useState<TrainingLoadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(42);

  useEffect(() => {
    setLoading(true);
    api.getTrainingLoad(days)
      .then(setData)
      .finally(() => setLoading(false));
  }, [days]);

  const history = data?.history ?? [];
  const current = data?.current;

  return (
    <div className="p-6 space-y-5 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Training Load</h1>
          <p className="text-sm text-gray-400 mt-0.5">Fitness, fatigue, form — and what they mean</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {[14, 28, 42, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                days === d ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Flags */}
          {data?.flags.map((f, i) => (
            <div key={i}
              className={`rounded-xl px-4 py-3 text-sm flex items-center gap-2 ${
                f.type === "danger" ? "bg-red-50 text-red-800 border border-red-200"
                : f.type === "warning" ? "bg-orange-50 text-orange-800 border border-orange-200"
                : "bg-blue-50 text-blue-800 border border-blue-200"
              }`}>
              <span>{f.type === "danger" ? "🚨" : f.type === "warning" ? "⚠️" : "💡"}</span>
              {f.message}
            </div>
          ))}

          {/* Charts — side by side */}
          <div className="grid grid-cols-2 gap-4">

            {/* Fitness vs Fatigue */}
            {history.length > 0 && (
              <div className="bg-white rounded-2xl p-5" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                  Fitness vs Fatigue
                </p>
                <p className="text-[10px] text-gray-400 mb-4">
                  Hover for exact values. Blue area = form (TSB). When blue is positive, you&apos;re fresh.
                </p>
                <ResponsiveContainer width="100%" height={180}>
                  <ComposedChart data={history.map((h) => ({ ...h, date: h.date.slice(5) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#9CA3AF" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                    <Tooltip
                      formatter={(v, name) => [Number(v).toFixed(1), String(name)]}
                      labelFormatter={(l) => `Date: ${l}`}
                    />
                    <ReferenceLine y={0} stroke="#D1D5DB" />
                    <Area dataKey="tsb" fill="#EDE9FE" stroke="none" name="TSB (Form)" />
                    <Line dataKey="ctl" stroke="#378ADD" strokeWidth={2} dot={false} name="CTL (Fitness)" />
                    <Line dataKey="atl" stroke="#F87171" strokeWidth={2} dot={false} name="ATL (Fatigue)" />
                  </ComposedChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-2">
                  {[
                    { label: "CTL (Fitness)", color: "#378ADD", type: "line" },
                    { label: "ATL (Fatigue)", color: "#F87171", type: "line" },
                    { label: "TSB (Form)", color: "#EDE9FE", type: "area" },
                  ].map(({ label, color, type }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div className="w-3" style={{ height: type === "area" ? 8 : 2, background: color, borderRadius: 2 }} />
                      <span className="text-[9px] text-gray-400">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ACWR with zones */}
            {history.length > 0 && (
              <div className="bg-white rounded-2xl p-5" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                  ACWR — Injury Risk Ratio
                </p>
                <p className="text-[10px] text-gray-400 mb-4">
                  Stay in the green zone (0.8–1.3). Red zone = elevated injury risk per research.
                </p>
                <ResponsiveContainer width="100%" height={180}>
                  <ComposedChart data={history.map((h) => ({ ...h, date: h.date.slice(5) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#9CA3AF" }} />
                    <YAxis domain={[0, 2.0]} tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                    <Tooltip formatter={(v) => [Number(v).toFixed(2), "ACWR"]} />
                    {/* Zone bands as reference lines with labels */}
                    <ReferenceLine y={0.8} stroke="#1D9E75" strokeDasharray="3 3"
                      label={{ value: "0.8 — optimal floor", position: "insideTopRight", fontSize: 8, fill: "#1D9E75" }} />
                    <ReferenceLine y={1.3} stroke="#EF9F27" strokeDasharray="3 3"
                      label={{ value: "1.3 — caution", position: "insideTopRight", fontSize: 8, fill: "#EF9F27" }} />
                    <ReferenceLine y={1.5} stroke="#E8593C" strokeDasharray="3 3"
                      label={{ value: "1.5 — high risk", position: "insideTopRight", fontSize: 8, fill: "#E8593C" }} />
                    <Line dataKey="acwr" stroke="#6366F1" strokeWidth={2} dot={false} name="ACWR" />
                  </ComposedChart>
                </ResponsiveContainer>
                <div className="flex gap-3 mt-2">
                  {[
                    { label: "Optimal: 0.8–1.3", color: "#1D9E75" },
                    { label: "Caution: 1.3–1.5", color: "#EF9F27" },
                    { label: "High risk: >1.5", color: "#E8593C" },
                  ].map(({ label, color }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                      <span className="text-[9px] text-gray-400">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Metric explainers — expandable */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
              What each metric means — click to expand
            </p>
            <div className="grid grid-cols-2 gap-3">
              {METRIC_EXPLAINERS.map((m) => (
                <MetricCard
                  key={m.key}
                  label={m.label} tagline={m.tagline} formula={m.formula}
                  good={m.good} bad={m.bad} range={m.range} color={m.color}
                  metricKey={m.key}
                  value={current ? (current as Record<string, number>)[m.key] : null}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
