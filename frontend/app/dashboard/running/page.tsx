"use client";

import { useEffect, useState } from "react";
import { api, type RunningData } from "@/lib/api";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

function fmtPace(s: number | null) {
  if (!s || s <= 0) return "—";
  const mins = Math.floor(s / 60);
  const secs = Math.round(s % 60);
  return `${mins}:${String(secs).padStart(2, "0")}/km`;
}

function fmtDuration(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl p-4" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1" style={{ fontFamily: "var(--font-dm-mono)" }}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// Custom Y-axis tick for pace — displays as MM:SS instead of raw seconds
function PaceTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: number } }) {
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fill="#9CA3AF" fontSize={10}>
      {fmtPace(payload?.value ?? null)}
    </text>
  );
}

export default function RunningPage() {
  const [data, setData] = useState<RunningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState(8);

  useEffect(() => {
    setLoading(true);
    api.getRunning(weeks)
      .then(setData)
      .finally(() => setLoading(false));
  }, [weeks]);

  const summary = data?.summary;
  const weekRows = data?.weeks ?? [];

  // Filter out implausible paces (< 3:30/km or > 12:00/km) before charting
  const paceData = weekRows
    .filter((w) => {
      const p = w.avg_pace_s_per_km;
      return p && p >= 210 && p <= 720;  // 3:30 – 12:00/km
    })
    .map((w) => ({
      week: w.week_start.slice(5),
      pace: w.avg_pace_s_per_km!,
    }));

  // Y-axis domain: pad 30s either side of actual range, clamped to realistic bounds
  const paceVals = paceData.map((d) => d.pace);
  const paceMin = paceVals.length ? Math.max(Math.min(...paceVals) - 30, 200) : 240;
  const paceMax = paceVals.length ? Math.min(Math.max(...paceVals) + 30, 720) : 480;

  const TrendIcon =
    summary?.pace_trend === "improving" ? TrendingUp
    : summary?.pace_trend === "declining" ? TrendingDown
    : Minus;
  const trendColor =
    summary?.pace_trend === "improving" ? "#1D9E75"
    : summary?.pace_trend === "declining" ? "#E8593C"
    : "#6B7280";

  return (
    <div className="p-6 space-y-5 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Running Metrics</h1>
          <p className="text-sm text-gray-400 mt-0.5">Volume, pace, and consistency over time</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {[4, 8, 12].map((w) => (
            <button key={w} onClick={() => setWeeks(w)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                weeks === w ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}>
              {w}w
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
          {summary && (
            <div className="grid grid-cols-4 gap-3">
              <StatCard label="Total Runs" value={String(summary.total_sessions)} sub={`${weeks} weeks`} />
              <StatCard label="Distance" value={`${summary.total_distance_km} km`}
                sub={`${summary.avg_weekly_km} km/week avg`} />
              <StatCard label="Longest Run" value={`${summary.longest_run_km} km`} />
              <StatCard label="Elevation" value={`${summary.total_elevation_m.toLocaleString()} m`} />
            </div>
          )}

          {/* Two charts side by side */}
          <div className="grid grid-cols-2 gap-4">

            {/* Avg pace per week */}
            <div className="bg-white rounded-2xl p-5" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Avg Pace per Week
                </p>
                {summary?.pace_trend && (
                  <div className="flex items-center gap-1.5" style={{ color: trendColor }}>
                    <TrendIcon size={13} />
                    <span className="text-xs font-medium capitalize">{summary.pace_trend}</span>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-gray-400 mb-4">
                Lower = faster. Y-axis is pace (min:sec/km) — reversed so improvement goes up.
              </p>
              {paceData.length < 2 ? (
                <div className="flex items-center justify-center h-40">
                  <p className="text-sm text-gray-400">Not enough steady runs with pace data.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={paceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                    <YAxis
                      reversed
                      domain={[paceMin, paceMax]}
                      tick={<PaceTick />}
                      width={52}
                    />
                    <Tooltip
                      formatter={(v) => [fmtPace(v != null ? Number(v) : null), "Avg Pace"]}
                      labelFormatter={(l) => `Week of ${l}`}
                    />
                    <Line
                      dataKey="pace"
                      stroke="#378ADD"
                      strokeWidth={2}
                      dot={{ r: 4, fill: "#378ADD", strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
              {summary?.first_half_pace_s_per_km && summary?.second_half_pace_s_per_km && (
                <p className="text-[10px] text-gray-400 mt-2">
                  First half avg: {fmtPace(summary.first_half_pace_s_per_km)} →
                  Recent avg: {fmtPace(summary.second_half_pace_s_per_km)}
                </p>
              )}
            </div>

            {/* Weekly mileage */}
            <div className="bg-white rounded-2xl p-5" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                Weekly Volume (km)
              </p>
              <p className="text-[10px] text-gray-400 mb-4">
                Hover bars for exact values. Dashed line = {summary?.avg_weekly_km} km/week average.
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={weekRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                  <XAxis dataKey="week_start" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                  <Tooltip
                    formatter={(v) => [`${v} km`, "Distance"]}
                    labelFormatter={(l) => `Week of ${l}`}
                  />
                  {summary?.avg_weekly_km && (
                    <ReferenceLine
                      y={summary.avg_weekly_km}
                      stroke="#9CA3AF"
                      strokeDasharray="4 4"
                    />
                  )}
                  <Bar dataKey="distance_km" fill="#378ADD" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Week table */}
          {weekRows.length > 0 && (
            <div className="bg-white rounded-2xl overflow-hidden"
              style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
                    {["Week", "Runs", "Distance", "Time", "Avg Pace", "Avg HR", "TSS"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...weekRows].reverse().map((w) => (
                    <tr key={w.week_start} className="border-b last:border-0 hover:bg-gray-50 transition-colors"
                      style={{ borderColor: "rgba(0,0,0,0.04)" }}>
                      <td className="px-4 py-3 text-xs text-gray-500">{w.week_start}</td>
                      <td className="px-4 py-3 text-xs text-gray-700">{w.sessions}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-gray-900">{w.distance_km} km</td>
                      <td className="px-4 py-3 text-xs text-gray-700">{fmtDuration(w.duration_s)}</td>
                      <td className="px-4 py-3 text-xs text-gray-700">{fmtPace(w.avg_pace_s_per_km)}</td>
                      <td className="px-4 py-3 text-xs text-gray-700">{w.avg_hr ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-gray-700">{w.tss.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {weekRows.length === 0 && (
            <div className="bg-white rounded-2xl p-10 text-center" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
              <p className="text-gray-400 text-sm">No running data in this window.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
