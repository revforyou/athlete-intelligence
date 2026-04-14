"use client";

import { useEffect, useState } from "react";
import { api, type HeartRateData } from "@/lib/api";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, Legend,
} from "recharts";

const ZONE_COLORS = ["#94A3B8", "#60A5FA", "#34D399", "#FBBF24", "#F87171"];
const ZONE_LABELS = ["Z1 Recovery", "Z2 Aerobic", "Z3 Tempo", "Z4 Threshold", "Z5 Max"];

export default function HRPage() {
  const [data, setData] = useState<HeartRateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState(8);

  useEffect(() => {
    let active = true;
    api.getHeartRate(weeks)
      .then((d) => { if (active) { setData(d); setLoading(false); } })
      .catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [weeks]);

  const zoneWeeks = data?.zone_weeks ?? [];
  const chartData = zoneWeeks.map((w) => ({
    week: w.week_start.slice(5),
    z1: Math.round(w.z1_mins),
    z2: Math.round(w.z2_mins),
    z3: Math.round(w.z3_mins),
    z4: Math.round(w.z4_mins),
    z5: Math.round(w.z5_mins),
  }));

  const latest = data?.latest_zones;
  const latestTotal = latest
    ? (latest.z1_mins + latest.z2_mins + latest.z3_mins + latest.z4_mins + latest.z5_mins)
    : 0;

  return (
    <div className="p-6 space-y-5 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Heart Rate Zones</h1>
          <p className="text-sm text-gray-400 mt-0.5">Training intensity distribution over time</p>
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

      {/* Data source clarity */}
      <div className="bg-gray-50 rounded-xl px-4 py-3 flex gap-3 items-start"
        style={{ border: "0.5px solid rgba(0,0,0,0.06)" }}>
        <span className="text-base mt-0.5">ℹ️</span>
        <div>
          <p className="text-xs font-semibold text-gray-700">Zone distribution includes all HR activities</p>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
            HR zones are computed from all activities with heart rate data (runs, rides, etc.).
            The avg HR trend chart below is filtered to runs only.
            Filtering zones by sport type requires re-processing HR streams — coming soon.
          </p>
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
                f.type === "warning" ? "bg-orange-50 text-orange-800 border border-orange-200"
                : "bg-blue-50 text-blue-800 border border-blue-200"
              }`}>
              <span>{f.type === "warning" ? "⚠️" : "ℹ️"}</span>
              {f.message}
            </div>
          ))}

          {/* Latest zone breakdown */}
          {latest && latestTotal > 0 && (
            <div className="bg-white rounded-2xl p-5" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  This Week&apos;s Zone Distribution
                </p>
                {data?.avg_polarization_4w !== null && (
                  <span className="text-xs text-gray-500">
                    4w avg polarization: <span className="font-semibold text-gray-800">
                      {data?.avg_polarization_4w}%
                    </span>
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((z) => {
                  const mins = latest[`z${z}_mins` as keyof typeof latest] as number ?? 0;
                  const pct = latestTotal > 0 ? (mins / latestTotal) * 100 : 0;
                  return (
                    <div key={z} className="flex items-center gap-3">
                      <span className="text-[10px] font-semibold text-gray-500 w-20 shrink-0">
                        {ZONE_LABELS[z - 1]}
                      </span>
                      <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: ZONE_COLORS[z - 1] }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 w-16 text-right">
                        {Math.round(mins)}m ({pct.toFixed(0)}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stacked bar chart */}
          {chartData.length > 0 && (
            <div className="bg-white rounded-2xl p-5" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">
                Zone Minutes per Week
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {[1, 2, 3, 4, 5].map((z) => (
                    <Bar key={z} dataKey={`z${z}`} name={ZONE_LABELS[z - 1]}
                      stackId="a" fill={ZONE_COLORS[z - 1]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Avg HR trend */}
          {(data?.hr_trend ?? []).length > 1 && (
            <div className="bg-white rounded-2xl p-5" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">
                Avg HR Trend (Runs)
              </p>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={data!.hr_trend.map((h) => ({ ...h, week: h.week_start.slice(5) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                  <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                  <Tooltip formatter={(v) => [`${v} bpm`, "Avg HR"]} />
                  <Line dataKey="avg_hr" stroke="#F87171" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-[10px] text-gray-400 mt-2">
                Declining HR at same pace = improving aerobic fitness.
              </p>
            </div>
          )}

          {/* Zone reference */}
          <div className="bg-white rounded-2xl p-5" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
              Your Zone Thresholds (max HR: {data?.max_hr})
            </p>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((z) => (
                <div key={z} className="text-center">
                  <div className="w-full h-2 rounded-full mb-2" style={{ background: ZONE_COLORS[z - 1] }} />
                  <p className="text-[10px] font-semibold text-gray-600">Z{z}</p>
                  <p className="text-[9px] text-gray-400">
                    {data?.zone_thresholds[`z${z}`] ?? "—"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {zoneWeeks.length === 0 && (
            <div className="bg-white rounded-2xl p-10 text-center" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
              <p className="text-gray-400 text-sm">No HR zone data yet. HR streams are processed after activity ingestion.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
