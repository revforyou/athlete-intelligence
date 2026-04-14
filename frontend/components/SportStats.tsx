"use client";

import type { ActivityStats } from "@/lib/api";

interface Props {
  stats: ActivityStats;
  period: "weekly" | "monthly";
}

function formatDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatPace(sPerKm: number): string {
  const m = Math.floor(sPerKm / 60);
  const s = sPerKm % 60;
  return `${m}:${String(s).padStart(2, "0")} /km`;
}

const SPORT_ICONS: Record<string, string> = {
  Run: "🏃",
  WeightTraining: "🏋️",
  Ride: "🚴",
  Swim: "🏊",
  Walk: "🚶",
  Hike: "🥾",
  All: "⚡",
};

export default function SportStats({ stats, period }: Props) {
  const label = period === "weekly" ? "This Week" : "This Month";

  const statCards = [
    {
      label: "Sessions",
      value: String(stats.total_sessions),
      icon: "📅",
      show: true,
    },
    {
      label: "Distance",
      value: stats.total_distance_km > 0 ? `${stats.total_distance_km} km` : "—",
      icon: "📍",
      show: stats.total_distance_km > 0,
    },
    {
      label: "Time",
      value: formatDuration(stats.total_duration_s),
      icon: "⏱️",
      show: stats.total_duration_s > 0,
    },
    {
      label: "Avg HR",
      value: stats.avg_hr ? `${stats.avg_hr} bpm` : "—",
      icon: "❤️",
      show: !!stats.avg_hr,
    },
    {
      label: "Avg Pace",
      value: stats.avg_pace_s_per_km ? formatPace(stats.avg_pace_s_per_km) : null,
      icon: "⚡",
      show: !!stats.avg_pace_s_per_km,
    },
    {
      label: "Total TSS",
      value: String(Math.round(stats.total_tss)),
      icon: "🔥",
      show: stats.total_tss > 0,
    },
  ].filter((s) => s.show && s.value);

  // Per-sport breakdown (only show when "All" tab)
  const sportBreakdown = Object.entries(stats.by_sport);

  return (
    <div className="bg-white rounded-2xl p-6 space-y-4"
      style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
          {label} — {stats.sport === "All" ? "All Sports" : stats.sport}
        </h2>
        <span className="text-lg">{SPORT_ICONS[stats.sport] ?? "🏅"}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {statCards.map((s) => (
          <div key={s.label} className="bg-[#F5F4F1] rounded-xl px-3 py-3">
            <p className="text-xs text-gray-400">{s.icon} {s.label}</p>
            <p className="text-base font-bold text-gray-900 mt-0.5"
              style={{ fontFamily: "var(--font-dm-mono)" }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {stats.sport === "All" && sportBreakdown.length > 1 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">By Sport</p>
          <div className="space-y-2">
            {sportBreakdown.map(([type, data]) => (
              <div key={type} className="flex items-center justify-between py-2"
                style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                <div className="flex items-center gap-2">
                  <span className="text-base">{SPORT_ICONS[type] ?? "🏅"}</span>
                  <span className="text-sm font-medium text-gray-700">{type}</span>
                </div>
                <div className="flex gap-3 text-xs text-gray-500">
                  <span>{data.sessions} sessions</span>
                  {data.distance_m > 0 && (
                    <span>{(data.distance_m / 1000).toFixed(1)} km</span>
                  )}
                  <span className="font-semibold text-gray-700"
                    style={{ fontFamily: "var(--font-dm-mono)" }}>
                    {Math.round(data.tss)} TSS
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
