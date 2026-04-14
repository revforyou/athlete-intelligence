"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type OverviewData, type DailyFeature } from "@/lib/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function riskColor(score: number | null) {
  if (score === null) return "#9CA3AF";
  if (score >= 76) return "#E8593C";
  if (score >= 56) return "#EF9F27";
  if (score >= 31) return "#378ADD";
  return "#1D9E75";
}

function riskLabel(score: number | null) {
  if (score === null) return "No data";
  if (score >= 76) return "High Risk";
  if (score >= 56) return "Elevated";
  if (score >= 31) return "Moderate";
  return "Low Risk";
}

function actionEmoji(action: string) {
  return action === "rest" ? "🛋️" : action === "easy" ? "🚶" : "✅";
}

/**
 * Generate a 2-sentence natural-language insight from the data the model sees.
 * This is deterministic so it never hallucinates.
 */
function buildInsight(
  phase: OverviewData["phase"],
  score: number | null,
  metrics: DailyFeature | null,
  topFactors: { name: string; value: number; shap: number }[]
): { summary: string; warning: string | null } {
  if (!metrics || score === null) {
    return { summary: "Not enough data yet — sync more activities to unlock insights.", warning: null };
  }

  const phaseStr = phase.phase !== "unknown" ? `in your ${phase.phase} phase` : "training";
  const riskStr = score >= 76 ? "high injury risk"
    : score >= 56 ? "elevated injury risk"
    : score >= 31 ? "moderate injury risk"
    : "low injury risk";

  const topFactor = topFactors[0];
  const factorStr = topFactor
    ? `driven mainly by ${topFactor.name.replace(/_/g, " ")} (${topFactor.value.toFixed(2)})`
    : "";

  const summary = `You are ${phaseStr} with ${riskStr}${factorStr ? `, ${factorStr}` : ""}.`;

  let warning: string | null = null;
  if (metrics.acwr > 1.5) {
    warning = "⚠️ Training load spiked 50% above your baseline — high injury risk zone. Back off now.";
  } else if (metrics.acwr > 1.3) {
    warning = "⚠️ Acute load is 30% above your baseline. Monitor closely and avoid adding intensity.";
  } else if (metrics.tsb < -25) {
    warning = "⚠️ Form is deeply negative (TSB " + metrics.tsb.toFixed(0) + "). Significant accumulated fatigue — prioritise sleep and easy days.";
  } else if (metrics.monotony > 2.5) {
    warning = "⚠️ Training monotony is high — you're doing the same thing every day. Add variety to reduce staleness and overuse risk.";
  } else if (metrics.acwr < 0.7) {
    warning = "💡 Load is well below your baseline. Safe to build volume — this is a good week to add km.";
  } else if (metrics.tsb > 20) {
    warning = "💡 Form is positive (TSB +" + metrics.tsb.toFixed(0) + "). You're fresh — a quality session or long run is a good call.";
  }

  return { summary, warning };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const router = useRouter();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getOverview()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-7 h-7 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin mx-auto" />
          <p className="text-xs text-gray-400">Loading your brief…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-red-500 text-sm">{error}</p>
          <button onClick={() => router.push("/")} className="text-xs text-gray-500 underline cursor-pointer">
            Back to home
          </button>
        </div>
      </div>
    );
  }

  const risk = data?.risk;
  const phase = data?.phase;
  const rec = data?.recommendation;
  const metrics = data?.metrics ?? null;
  const sparkline = data?.tss_sparkline ?? {};
  const topFactors = risk?.top_factors ?? [];
  const score = risk?.score ?? null;
  const color = riskColor(score);

  const { summary, warning } = buildInsight(
    phase ?? { phase: "unknown", emoji: "❓", confidence: "low", reasoning: "", guidance: "", metrics: { ctl: 0, atl: 0, tsb: 0, acwr: 0, ctl_trend_4w: 0, tsb_trend_1w: 0 } },
    score,
    metrics,
    topFactors
  );

  // TSS sparkline — last 7 days
  const sparkDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().split("T")[0];
    const dayLabel = d.toLocaleDateString("en", { weekday: "short" });
    return { date: key, tss: sparkline[key] ?? 0, label: dayLabel };
  });
  const maxTss = Math.max(...sparkDays.map((d) => d.tss), 1);

  // SHAP factor display helpers
  const shapMax = Math.max(...topFactors.map((f) => Math.abs(f.shap)), 0.001);

  return (
    <div className="p-6 space-y-5 w-full">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Daily Training Brief</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {new Date().toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        {risk?.calibration && (
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            risk.calibration.confidence === "high" ? "bg-green-100 text-green-700"
            : risk.calibration.confidence === "medium" ? "bg-blue-100 text-blue-700"
            : "bg-gray-100 text-gray-500"
          }`}>
            {risk.calibration.message}
          </span>
        )}
      </div>

      {/* ── Insight banner ── */}
      <div className="bg-white rounded-2xl p-5 space-y-3" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">AI Summary</p>
        <p className="text-base text-gray-800 leading-relaxed font-medium">{summary}</p>
        {warning && (
          <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
            warning.startsWith("⚠️")
              ? "bg-orange-50 text-orange-800 border border-orange-100"
              : "bg-blue-50 text-blue-800 border border-blue-100"
          }`}>
            {warning}
          </div>
        )}
      </div>

      {/* ── 3-column top row ── */}
      <div className="grid grid-cols-3 gap-4">

        {/* Risk dial */}
        <div className="bg-white rounded-2xl p-5 flex flex-col items-center gap-3"
          style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 self-start">
            Injury Risk Score
          </p>
          <div className="relative w-32 h-32">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#F3F4F6" strokeWidth="12" />
              <circle
                cx="60" cy="60" r="50" fill="none"
                stroke={color} strokeWidth="12"
                strokeDasharray={`${(score ?? 0) / 100 * 314} 314`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold" style={{ color, fontFamily: "var(--font-dm-mono)" }}>
                {score ?? "—"}
              </span>
              <span className="text-[10px] text-gray-400 font-medium mt-0.5">/100</span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold" style={{ color }}>{riskLabel(score)}</p>
            {risk?.as_of && <p className="text-[10px] text-gray-400 mt-0.5">as of {risk.as_of}</p>}
          </div>
        </div>

        {/* Training phase */}
        <div className="bg-white rounded-2xl p-5 flex flex-col gap-3"
          style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Training Phase</p>
          {phase && phase.phase !== "unknown" ? (
            <>
              <div className="flex items-center gap-3">
                <span className="text-4xl">{phase.emoji}</span>
                <div>
                  <p className="text-xl font-bold text-gray-900 capitalize">{phase.phase}</p>
                  <p className="text-xs text-gray-400 capitalize">{phase.confidence} confidence</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed flex-1">{phase.guidance}</p>
            </>
          ) : (
            <p className="text-sm text-gray-400 mt-2">Log more runs to classify your phase.</p>
          )}
        </div>

        {/* Today's recommendation */}
        <div className="bg-white rounded-2xl p-5 flex flex-col gap-3"
          style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Today&apos;s Plan</p>
          {rec ? (
            <>
              <div className="flex items-start gap-3">
                <span className="text-3xl mt-0.5">{actionEmoji(rec.action)}</span>
                <p className="text-sm text-gray-700 leading-relaxed">{rec.text}</p>
              </div>
              <div className={`mt-auto inline-flex self-start px-3 py-1 rounded-full text-xs font-bold ${
                rec.action === "rest" ? "bg-red-100 text-red-700"
                : rec.action === "easy" ? "bg-amber-100 text-amber-700"
                : "bg-green-100 text-green-700"
              }`}>
                {rec.action === "rest" ? "REST" : rec.action === "easy" ? "EASY DAY" : "TRAIN"}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400">No recommendation yet — risk score is computing.</p>
          )}
        </div>
      </div>

      {/* ── Why is my score X? (SHAP) ── */}
      {topFactors.length > 0 && (
        <div className="bg-white rounded-2xl p-5" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
          <div className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Why is my risk score {score}?
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              SHAP values — bar width = how much each factor pushed the score up (red) or down (green)
            </p>
          </div>
          <div className="space-y-3">
            {topFactors.map((f) => {
              const pct = Math.min((Math.abs(f.shap) / shapMax) * 100, 100);
              const isRisk = f.shap > 0;
              const metricLabels: Record<string, { name: string; context: string }> = {
                acwr:                { name: "Load ratio (ACWR)", context: `${f.value.toFixed(2)} — ${f.value > 1.3 ? "above safe zone" : f.value < 0.8 ? "below baseline" : "in optimal range"}` },
                monotony:            { name: "Training monotony", context: `${f.value.toFixed(2)} — ${f.value > 2 ? "high repetition" : "good variety"}` },
                strain:              { name: "Weekly strain", context: f.value.toFixed(1) },
                days_since_rest:     { name: "Days since rest", context: `${f.value.toFixed(0)} days` },
                volume_delta_pct:    { name: "Volume spike", context: `${(f.value * 100).toFixed(0)}% week-over-week` },
                zone_imbalance_score:{ name: "Zone imbalance", context: f.value.toFixed(2) },
              };
              const label = metricLabels[f.name] ?? { name: f.name.replace(/_/g, " "), context: f.value.toFixed(2) };
              return (
                <div key={f.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <span className="text-sm font-medium text-gray-800 capitalize">{label.name}</span>
                      <span className="text-xs text-gray-400 ml-2">{label.context}</span>
                    </div>
                    <span className={`text-xs font-semibold ${isRisk ? "text-red-600" : "text-green-600"}`}>
                      {isRisk ? "↑ increases risk" : "↓ reduces risk"}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: isRisk ? "#E8593C" : "#1D9E75" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Metrics strip + sparkline ── */}
      <div className="grid grid-cols-3 gap-4">

        {/* Key metrics */}
        <div className="col-span-2 grid grid-cols-3 gap-3">
          {metrics ? (
            [
              { label: "CTL", value: metrics.ctl?.toFixed(1), desc: "Fitness base", good: true },
              { label: "ATL", value: metrics.atl?.toFixed(1), desc: "Current fatigue", good: metrics.atl < 80 },
              { label: "TSB", value: metrics.tsb?.toFixed(1), desc: "Form", good: (metrics.tsb ?? 0) > -15 },
              { label: "ACWR", value: metrics.acwr?.toFixed(2), desc: "Load ratio", good: metrics.acwr <= 1.3 && metrics.acwr >= 0.8 },
              { label: "Monotony", value: metrics.monotony?.toFixed(2), desc: "Variety", good: metrics.monotony <= 2 },
              { label: "Strain", value: metrics.strain?.toFixed(1), desc: "Weekly stress", good: true },
            ].map(({ label, value, desc, good }) => (
              <div key={label} className="bg-white rounded-xl p-3"
                style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
                <p className={`text-xl font-bold mt-1 ${good ? "text-gray-900" : "text-orange-500"}`}
                  style={{ fontFamily: "var(--font-dm-mono)" }}>
                  {value ?? "—"}
                </p>
                <p className="text-[9px] text-gray-400 mt-0.5">{desc}</p>
              </div>
            ))
          ) : (
            <div className="col-span-3 flex items-center justify-center py-8">
              <p className="text-sm text-gray-400">No feature data yet.</p>
            </div>
          )}
        </div>

        {/* TSS sparkline */}
        <div className="bg-white rounded-2xl p-4" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-3">
            Load — Last 7 Days
          </p>
          <div className="flex items-end gap-1 h-24">
            {sparkDays.map((d) => {
              const barH = maxTss > 0 ? Math.max((d.tss / maxTss) * 100, d.tss > 0 ? 10 : 0) : 0;
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center" style={{ height: 72 }}>
                    <div
                      title={`${d.label}: ${d.tss} TSS`}
                      className="w-full rounded-sm transition-all"
                      style={{
                        height: `${barH}%`,
                        background: d.tss > 0 ? "#378ADD" : "transparent",
                        border: d.tss === 0 ? "0.5px dashed #E5E7EB" : "none",
                        minHeight: d.tss === 0 ? 4 : undefined,
                      }}
                    />
                  </div>
                  <span className="text-[8px] text-gray-400">{d.label.slice(0, 2)}</span>
                  {d.tss > 0 && (
                    <span className="text-[8px] text-gray-500 font-medium">{d.tss}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
