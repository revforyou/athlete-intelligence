"use client";

import { useEffect, useState } from "react";
import { api, type TrainingPhase } from "@/lib/api";

const PHASE_DESCRIPTIONS: Record<string, { what: string; do: string }> = {
  base: {
    what: "Building your aerobic engine. CTL is growing slowly with controlled load.",
    do: "Keep intensity low (Z1-Z2). Prioritize volume and consistency over speed.",
  },
  build: {
    what: "Progressive overload phase — CTL rising steadily with healthy ACWR.",
    do: "Add quality sessions (tempo, intervals). Monitor ACWR to stay under 1.3.",
  },
  peak: {
    what: "Maximum fitness reached with good form (TSB in positive territory).",
    do: "Race or time trial window. Protect this form — no new stressors.",
  },
  taper: {
    what: "Freshness rising fast while fitness holds. You're peaking for an event.",
    do: "Short, sharp sessions only. Trust the fitness you've banked.",
  },
  recovery: {
    what: "TSB is high (very fresh) — you've been backing off training load.",
    do: "Easy aerobic work only. Let the body adapt and repair.",
  },
  transition: {
    what: "Between training blocks. Load pattern doesn't fit a standard phase.",
    do: "Focus on consistency. Good time to address weaknesses.",
  },
};

export default function PhasePage() {
  const [data, setData] = useState<TrainingPhase | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPhase()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const desc = data ? PHASE_DESCRIPTIONS[data.phase] : null;

  return (
    <div className="p-6 space-y-5 w-full">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Training Phase</h1>
        <p className="text-sm text-gray-400 mt-0.5">Where you are in your training cycle</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
        </div>
      ) : !data || data.phase === "unknown" ? (
        <div className="bg-white rounded-2xl p-10 text-center" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
          <p className="text-gray-400 text-sm">Not enough data yet. Log at least 7 days of activity.</p>
        </div>
      ) : (
        <>
          {/* Phase hero */}
          <div className="bg-white rounded-2xl p-6" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
            <div className="flex items-start gap-5">
              <span className="text-6xl">{data.emoji}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-2xl font-bold text-gray-900 capitalize">{data.phase}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    data.confidence === "high" ? "bg-green-100 text-green-700"
                    : data.confidence === "medium" ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-600"
                  }`}>
                    {data.confidence} confidence
                  </span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed mb-3">{data.reasoning}</p>
                <div className="bg-[#F0F6FF] rounded-xl px-4 py-3 flex items-start gap-2"
                  style={{ border: "0.5px solid #C7DCFB" }}>
                  <span className="text-lg">💡</span>
                  <p className="text-sm text-gray-700 leading-relaxed">{data.guidance}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Phase description */}
          {desc && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-4" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">What this phase means</p>
                <p className="text-sm text-gray-700 leading-relaxed">{desc.what}</p>
              </div>
              <div className="bg-white rounded-xl p-4" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">What to do</p>
                <p className="text-sm text-gray-700 leading-relaxed">{desc.do}</p>
              </div>
            </div>
          )}

          {/* Supporting metrics */}
          {data.metrics && (
            <div className="bg-white rounded-2xl p-5" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">
                Supporting Metrics
              </p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "CTL", value: data.metrics.ctl, sub: "Fitness" },
                  { label: "ATL", value: data.metrics.atl, sub: "Fatigue" },
                  { label: "TSB", value: data.metrics.tsb, sub: "Form" },
                  { label: "ACWR", value: data.metrics.acwr, sub: "Load ratio", decimals: 2 },
                  { label: "CTL trend (4w)", value: data.metrics.ctl_trend_4w, sub: "Fitness change", sign: true },
                  { label: "TSB trend (1w)", value: data.metrics.tsb_trend_1w, sub: "Freshness change", sign: true },
                ].map(({ label, value, sub, decimals = 1, sign = false }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3 text-center"
                    style={{ border: "0.5px solid rgba(0,0,0,0.06)" }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
                    <p className="text-xl font-bold text-gray-900 mt-1" style={{ fontFamily: "var(--font-dm-mono)" }}>
                      {sign && value > 0 ? "+" : ""}{value?.toFixed(decimals)}
                    </p>
                    <p className="text-[9px] text-gray-400 mt-0.5">{sub}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Phase history */}
          {data.history && data.history.length > 0 && (
            <div className="bg-white rounded-2xl p-5" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">
                Phase History
              </p>
              <div className="flex gap-2 flex-wrap">
                {data.history.map((h) => (
                  <div key={h.date} className="flex flex-col items-center gap-1">
                    <span className="text-xl">{h.emoji}</span>
                    <span className="text-[9px] text-gray-400 capitalize">{h.phase.slice(0, 4)}</span>
                    <span className="text-[8px] text-gray-300">{h.date.slice(5)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Phase cycle diagram */}
          <div className="bg-white rounded-2xl p-5" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
              Training Cycle
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { phase: "base", emoji: "🧱" },
                { phase: "build", emoji: "📈" },
                { phase: "peak", emoji: "🔥" },
                { phase: "taper", emoji: "🏁" },
                { phase: "recovery", emoji: "🛋️" },
              ].map(({ phase, emoji }, i, arr) => (
                <>
                  <div key={phase}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                      data.phase === phase ? "bg-[#F0F6FF] ring-1 ring-[#378ADD]" : "bg-gray-50"
                    }`}>
                    <span>{emoji}</span>
                    <span className="text-xs font-medium text-gray-700 capitalize">{phase}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <span key={`arrow-${i}`} className="text-gray-300 text-sm">→</span>
                  )}
                </>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
