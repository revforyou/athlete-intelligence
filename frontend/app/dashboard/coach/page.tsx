"use client";

import { useEffect, useState } from "react";
import { api, type TodayScore, type OverviewData } from "@/lib/api";

function ActionBadge({ action }: { action: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    train: { label: "TRAIN", color: "#1D9E75", bg: "#DCFCE7" },
    easy: { label: "EASY DAY", color: "#EF9F27", bg: "#FEF3C7" },
    rest: { label: "REST", color: "#E8593C", bg: "#FEE2E2" },
  };
  const style = map[action] ?? { label: action.toUpperCase(), color: "#6B7280", bg: "#F3F4F6" };
  return (
    <span className="text-xs font-bold px-2.5 py-1 rounded-full"
      style={{ color: style.color, background: style.bg }}>
      {style.label}
    </span>
  );
}

export default function CoachPage() {
  const [score, setScore] = useState<TodayScore | null>(null);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getTodayScore(), api.getOverview()])
      .then(([s, o]) => { setScore(s); setOverview(o); })
      .finally(() => setLoading(false));
  }, []);

  const rec = score?.recommendation;

  return (
    <div className="p-6 space-y-5 w-full">
      <div>
        <h1 className="text-xl font-bold text-gray-900">AI Coach</h1>
        <p className="text-sm text-gray-400 mt-0.5">Today&apos;s recommendation from your training data</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Today's recommendation */}
          <div className="bg-white rounded-2xl p-6" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
            <div className="flex items-center gap-3 mb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Today</p>
              {rec && <ActionBadge action={rec.action} />}
            </div>
            {rec ? (
              <div className="flex items-start gap-4">
                <span className="text-4xl">
                  {rec.action === "rest" ? "🛋️" : rec.action === "easy" ? "🚶" : "✅"}
                </span>
                <p className="text-base text-gray-800 leading-relaxed">{rec.text}</p>
              </div>
            ) : (
              <p className="text-gray-400 text-sm">
                No recommendation yet. Make sure your Strava activities are synced and risk score is computed.
              </p>
            )}
          </div>

          {/* What the AI sees */}
          <div className="bg-white rounded-2xl p-5" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">
              What the AI sees
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Risk Score", value: score ? `${score.score}/100` : "—", sub: score?.calibration?.confidence ? `${score.calibration.confidence} confidence` : "" },
                { label: "Training Phase", value: overview?.phase.emoji && overview?.phase.phase ? `${overview.phase.emoji} ${overview.phase.phase}` : "—", sub: "" },
                { label: "ATL (Fatigue)", value: overview?.metrics?.atl?.toFixed(1) ?? "—", sub: "7-day avg load" },
                { label: "CTL (Fitness)", value: overview?.metrics?.ctl?.toFixed(1) ?? "—", sub: "42-day avg load" },
                { label: "TSB (Form)", value: overview?.metrics?.tsb?.toFixed(1) ?? "—", sub: "CTL − ATL" },
                { label: "ACWR", value: overview?.metrics?.acwr?.toFixed(2) ?? "—", sub: "Load ratio" },
              ].map(({ label, value, sub }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3"
                  style={{ border: "0.5px solid rgba(0,0,0,0.06)" }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
                  <p className="text-base font-bold text-gray-900 mt-1" style={{ fontFamily: "var(--font-dm-mono)" }}>
                    {value}
                  </p>
                  {sub && <p className="text-[9px] text-gray-400 mt-0.5">{sub}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Top risk factors */}
          {score?.top_factors.length ? (
            <div className="bg-white rounded-2xl p-5" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Top factors influencing today&apos;s score
              </p>
              <div className="space-y-3">
                {score.top_factors.map((f) => (
                  <div key={f.name} className="flex items-center gap-3">
                    <div className="w-32 shrink-0">
                      <p className="text-xs font-medium text-gray-700 capitalize">
                        {f.name.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-gray-400" style={{ fontFamily: "var(--font-dm-mono)" }}>
                        {f.value.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(Math.abs(f.shap) * 500, 100)}%`,
                          background: f.shap > 0 ? "#E8593C" : "#1D9E75",
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400 w-16 text-right">
                      {f.shap > 0 ? "↑ risk" : "↓ risk"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* How it works */}
          <div className="bg-gray-50 rounded-xl px-4 py-4" style={{ border: "0.5px solid rgba(0,0,0,0.06)" }}>
            <p className="text-xs font-semibold text-gray-700 mb-2">How the AI coach works</p>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              The recommendation is generated by Groq&apos;s Llama-3.1-8b model, given your risk score, ATL/CTL/TSB,
              ACWR, HR zone balance, and top risk factors as context. The model is instructed to respond in 2-3 sentences
              and end with a clear action: [TRAIN], [EASY DAY], or [REST]. Recommendations are cached daily and
              regenerated when your score changes significantly.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
