"use client";

import { useEffect, useState } from "react";
import { api, type TodayScore, type ScoreHistory } from "@/lib/api";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";

function riskColor(score: number) {
  if (score >= 76) return "#E8593C";
  if (score >= 56) return "#EF9F27";
  if (score >= 31) return "#378ADD";
  return "#1D9E75";
}

function riskLabel(score: number) {
  if (score >= 76) return "High Risk";
  if (score >= 56) return "Elevated";
  if (score >= 31) return "Moderate";
  return "Low Risk";
}

function riskDescription(score: number) {
  if (score >= 76) return "Training load and patterns suggest significant injury risk. Back off intensity immediately.";
  if (score >= 56) return "Some risk factors elevated. Be cautious adding load or intensity this week.";
  if (score >= 31) return "Moderate risk — normal training is fine, but don't spike load.";
  return "Low risk. Training load is well-managed. Good time to build or do quality work.";
}

export default function RecoveryPage() {
  const [score, setScore] = useState<TodayScore | null>(null);
  const [history, setHistory] = useState<ScoreHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getTodayScore(), api.getScoreHistory()])
      .then(([s, h]) => { setScore(s); setHistory(h); })
      .finally(() => setLoading(false));
  }, []);

  const s = score?.score ?? 0;
  const color = score ? riskColor(s) : "#6B7280";
  const shapMax = Math.max(...(score?.top_factors ?? []).map((f) => Math.abs(f.shap)), 0.001);

  const FACTOR_META: Record<string, { name: string; explain: (v: number) => string }> = {
    acwr:                { name: "Load Ratio (ACWR)",    explain: (v) => v > 1.3 ? `${v.toFixed(2)} — above safe zone (>1.3)` : `${v.toFixed(2)} — within optimal range` },
    monotony:            { name: "Training Monotony",    explain: (v) => v > 2 ? `${v.toFixed(2)} — training too repetitive` : `${v.toFixed(2)} — good variety` },
    strain:              { name: "Weekly Strain",         explain: (v) => v.toFixed(1) },
    days_since_rest:     { name: "Days Since Rest",       explain: (v) => `${v.toFixed(0)} consecutive days` },
    volume_delta_pct:    { name: "Volume Change",         explain: (v) => `${(v * 100).toFixed(0)}% week-over-week` },
    zone_imbalance_score:{ name: "Zone Imbalance",        explain: (v) => v.toFixed(2) },
  };

  return (
    <div className="p-6 space-y-5 w-full">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Recovery & Risk</h1>
        <p className="text-sm text-gray-400 mt-0.5">Injury risk score explained — what's driving it and how to act</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Score hero — full width, prominent */}
          <div className="bg-white rounded-2xl p-6" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
            <div className="grid grid-cols-3 gap-6 items-center">
              {/* Dial */}
              <div className="flex items-center gap-5">
                <div className="relative w-28 h-28 shrink-0">
                  <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="#F3F4F6" strokeWidth="12" />
                    <circle cx="60" cy="60" r="50" fill="none" stroke={color} strokeWidth="12"
                      strokeDasharray={`${s / 100 * 314} 314`} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold" style={{ color, fontFamily: "var(--font-dm-mono)" }}>{s}</span>
                    <span className="text-[9px] text-gray-400">/100</span>
                  </div>
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color }}>{riskLabel(s)}</p>
                  {score?.calibration && (
                    <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full mt-1.5 font-medium ${
                      score.calibration.confidence === "high" ? "bg-green-100 text-green-700"
                      : score.calibration.confidence === "medium" ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-600"
                    }`}>
                      {score.calibration.confidence} confidence · {score.calibration.message}
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="col-span-2 border-l pl-6" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 text-[10px]">
                  What this means
                </p>
                <p className="text-base text-gray-800 leading-relaxed">{riskDescription(s)}</p>
              </div>
            </div>
          </div>

          {/* WHY section — SHAP as primary content */}
          {score?.top_factors && score.top_factors.length > 0 && (
            <div className="bg-white rounded-2xl p-5" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Why is your score {s}?
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  SHAP values show how much each training factor pushed your score up or down.
                  Width = magnitude of influence. These are the actual model weights, not estimates.
                </p>
              </div>

              <div className="space-y-4">
                {score.top_factors.map((f) => {
                  const meta = FACTOR_META[f.name];
                  const pct = Math.min((Math.abs(f.shap) / shapMax) * 100, 100);
                  const isRisk = f.shap > 0;
                  return (
                    <div key={f.name} className="space-y-1.5">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">
                            {meta?.name ?? f.name.replace(/_/g, " ")}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {meta?.explain(f.value) ?? f.value.toFixed(2)}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <span className={`text-xs font-bold ${isRisk ? "text-red-600" : "text-green-600"}`}>
                            {isRisk ? "↑ raises score" : "↓ lowers score"}
                          </span>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            SHAP: {f.shap > 0 ? "+" : ""}{f.shap.toFixed(4)}
                          </p>
                        </div>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: isRisk ? "#E8593C" : "#1D9E75" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 pt-4 border-t flex gap-4" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-[#E8593C]" />
                  <span className="text-[10px] text-gray-500">Raises injury risk</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-[#1D9E75]" />
                  <span className="text-[10px] text-gray-500">Reduces injury risk</span>
                </div>
                <span className="text-[10px] text-gray-400 ml-auto">
                  Model: logistic regression · features: ACWR, monotony, strain, rest days, volume delta, zone imbalance
                </span>
              </div>
            </div>
          )}

          {/* Score history */}
          {history.length > 1 && (
            <div className="bg-white rounded-2xl p-5" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                Risk Score History — 6 Weeks
              </p>
              <p className="text-[10px] text-gray-400 mb-4">
                Dots are color-coded by risk tier. Hover for exact score and date.
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={history.map((h) => ({ ...h, date: h.date.slice(5) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                  <Tooltip formatter={(v) => [`${v}`, "Risk Score"]} labelFormatter={(l) => `Date: ${l}`} />
                  <ReferenceLine y={30} stroke="#1D9E75" strokeDasharray="2 4" label={{ value: "low", position: "right", fontSize: 8, fill: "#1D9E75" }} />
                  <ReferenceLine y={55} stroke="#EF9F27" strokeDasharray="2 4" label={{ value: "elevated", position: "right", fontSize: 8, fill: "#EF9F27" }} />
                  <ReferenceLine y={75} stroke="#E8593C" strokeDasharray="2 4" label={{ value: "high", position: "right", fontSize: 8, fill: "#E8593C" }} />
                  <Line
                    dataKey="score"
                    stroke="#378ADD"
                    strokeWidth={2}
                    dot={(props) => {
                      const { cx = 0, cy = 0, payload } = props as { cx?: number; cy?: number; payload: { score: number } };
                      return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={4} fill={riskColor(payload.score)} stroke="white" strokeWidth={1.5} />;
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Feedback */}
          <FeedbackRow riskScore={score?.score} />
        </>
      )}
    </div>
  );
}

function FeedbackRow({ riskScore }: { riskScore?: number }) {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (rating: string) => {
    setSubmitting(true);
    try { await api.submitFeedback(rating, riskScore); setSent(true); }
    finally { setSubmitting(false); }
  };

  if (sent) {
    return (
      <div className="bg-white rounded-2xl p-5 text-center" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
        <p className="text-sm text-gray-600">Thanks — this trains the Bayesian calibration model. ✓</p>
        <p className="text-xs text-gray-400 mt-1">Your score will personalise over 8+ sessions.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
        How accurate does this score feel?
      </p>
      <p className="text-xs text-gray-400 mb-4">
        Your answer trains the Bayesian calibration model — it shifts future scores to match your actual experience.
      </p>
      <div className="flex gap-3">
        {[
          { label: "Score is too high — felt easy", rating: "easy", color: "#378ADD" },
          { label: "About right", rating: "about_right", color: "#1D9E75" },
          { label: "Score is too low — felt very hard", rating: "too_hard", color: "#E8593C" },
        ].map(({ label, rating, color }) => (
          <button key={rating} disabled={submitting} onClick={() => submit(rating)}
            className="flex-1 py-2.5 rounded-xl text-xs font-medium border transition-all cursor-pointer hover:opacity-90"
            style={{ borderColor: color, color }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
