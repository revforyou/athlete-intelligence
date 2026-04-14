"use client";

import { useEffect, useState } from "react";
import { api, type VO2maxData } from "@/lib/api";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

function TrendIcon({ trend }: { trend: string | null }) {
  if (trend === "improving") return <TrendingUp size={14} color="#1D9E75" />;
  if (trend === "declining") return <TrendingDown size={14} color="#E8593C" />;
  return <Minus size={14} color="#6B7280" />;
}

function fmtPace(s: number | null) {
  if (!s) return "—";
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}/km`;
}

const VO2_NORMS = [
  { label: "Elite (< 25)", min: 65 },
  { label: "Excellent (25–29)", min: 55 },
  { label: "Good (30–39)", min: 46 },
  { label: "Average (40–49)", min: 38 },
  { label: "Below average (50+)", min: 0 },
];

function getVO2norm(v: number) {
  return VO2_NORMS.find((n) => v >= n.min)?.label ?? "Below average";
}

export default function VO2maxPage() {
  const [data, setData] = useState<VO2maxData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getVO2max().then(setData).finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 space-y-5 w-full">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Estimated VO2max <span className="text-sm font-normal text-gray-400">(proxy)</span></h1>
        <p className="text-sm text-gray-400 mt-0.5">Aerobic capacity estimate — not a lab test, but a directional signal</p>
      </div>

      {/* What this is */}
      <div className="bg-amber-50 rounded-xl px-4 py-3 flex gap-3 items-start"
        style={{ border: "0.5px solid #FDE68A" }}>
        <span className="text-lg mt-0.5">⚗️</span>
        <div>
          <p className="text-xs font-semibold text-amber-800">This is a proxy estimate, not a clinical VO2max</p>
          <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
            Calculated using the ACSM running equation (pace + HR ratio). Only qualifying runs are used:
            15+ min, 2+ km, HR between 50–95% of max HR, pace between 3:30–10:00/km.
            Smoothed over last 10 qualifying runs for stability. Treat the trend, not the exact number.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
        </div>
      ) : !data?.current ? (
        <div className="bg-white rounded-2xl p-10 text-center" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
          <p className="text-gray-700 font-medium text-sm">Not enough qualifying runs yet</p>
          <p className="text-gray-400 text-xs mt-2 leading-relaxed">
            Need runs that are 15+ minutes, with HR data, at a sustainable effort (50–95% max HR).
            Log more steady-state runs to see an estimate.
          </p>
        </div>
      ) : (
        <>
          {/* Hero row */}
          <div className="grid grid-cols-3 gap-4">

            {/* Current VO2max */}
            <div className="bg-white rounded-2xl p-5 flex flex-col items-center gap-2"
              style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 self-start">
                Current estimate
              </p>
              <p className="text-5xl font-bold text-gray-900 mt-2" style={{ fontFamily: "var(--font-dm-mono)" }}>
                {data.current}
              </p>
              <p className="text-xs text-gray-400">ml/kg/min · 10-run median</p>
              <div className="flex items-center gap-1.5 mt-1">
                <TrendIcon trend={data.trend} />
                <span className="text-xs text-gray-600 capitalize">
                  {data.trend ?? "stable"}{data.trend_value ? ` (${data.trend_value > 0 ? "+" : ""}${data.trend_value})` : ""}
                </span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full mt-1 font-medium ${
                data.confidence === "high" ? "bg-green-100 text-green-700"
                : data.confidence === "medium" ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-600"
              }`}>
                {data.confidence} confidence · {data.sample_size} qualifying runs
              </span>
            </div>

            {/* Fitness age + norm */}
            <div className="bg-white rounded-2xl p-5 flex flex-col gap-3"
              style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Fitness Age</p>
              <p className="text-5xl font-bold text-gray-900 mt-1" style={{ fontFamily: "var(--font-dm-mono)" }}>
                {data.fitness_age ?? "—"}
              </p>
              <p className="text-xs text-gray-400">years (Cooper Institute norms)</p>
              <div className="mt-auto pt-3 border-t" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
                <p className="text-xs text-gray-500">
                  Rating: <span className="font-semibold text-gray-900">{getVO2norm(data.current!)}</span>
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">Based on male age norms. Adjust accordingly.</p>
              </div>
            </div>

            {/* Race predictions preview */}
            {data.race_predictions && (
              <div className="bg-white rounded-2xl p-5 flex flex-col gap-2"
                style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Race Predictions
                </p>
                <p className="text-[10px] text-gray-400 mb-1">Based on best-effort estimate</p>
                {Object.entries(data.race_predictions).map(([name, pred]) => (
                  <div key={name} className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{name}</span>
                    <span className="text-sm font-bold text-gray-900" style={{ fontFamily: "var(--font-dm-mono)" }}>
                      {pred.time}
                    </span>
                  </div>
                ))}
                <a href="/dashboard/race" className="text-xs text-[#378ADD] hover:underline mt-auto">
                  Full analysis →
                </a>
              </div>
            )}
          </div>

          {/* Trend chart */}
          {data.history.length > 1 && (
            <div className="bg-white rounded-2xl p-5" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                VO2max Trend Over Time
              </p>
              <p className="text-[10px] text-gray-400 mb-4">
                Each point = one qualifying run estimate. Dashed line = current smoothed estimate ({data.current}).
                Focus on the overall direction, not individual data points.
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={data.history.map((h) => ({ ...h, date: h.date.slice(5) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                  <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                  <Tooltip
                    formatter={(v) => [`${v}`, "VO2max estimate"]}
                    labelFormatter={(l) => `Run date: ${l}`}
                  />
                  <ReferenceLine y={data.current!} stroke="#378ADD" strokeDasharray="4 4" />
                  <Line dataKey="vo2max" stroke="#378ADD" strokeWidth={1.5} dot={{ r: 2.5, fill: "#378ADD" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top contributing runs */}
          {data.top_contributing_runs.length > 0 && (
            <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
              <div className="px-5 py-3 border-b" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Best Qualifying Runs (highest VO2max estimates)
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  These runs had the best pace-to-HR ratio — closest to your aerobic ceiling
                </p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: "rgba(0,0,0,0.04)" }}>
                    {["Date", "Distance", "Avg HR", "Pace", "VO2max est."].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.top_contributing_runs.map((r) => (
                    <tr key={r.date} className="border-b last:border-0 hover:bg-gray-50"
                      style={{ borderColor: "rgba(0,0,0,0.04)" }}>
                      <td className="px-4 py-3 text-xs text-gray-500">{r.date}</td>
                      <td className="px-4 py-3 text-xs text-gray-700">{r.distance_km} km</td>
                      <td className="px-4 py-3 text-xs text-gray-700">{r.avg_hr} bpm</td>
                      <td className="px-4 py-3 text-xs text-gray-700">{fmtPace(r.pace_s_per_km)}</td>
                      <td className="px-4 py-3 text-sm font-bold text-[#378ADD]"
                        style={{ fontFamily: "var(--font-dm-mono)" }}>
                        {r.vo2max}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
