"use client";

import type { Activity } from "@/lib/api";

interface Props {
  activities: Activity[];
}

function tssColor(tss: number): string {
  if (tss >= 150) return "#E8593C";
  if (tss >= 100) return "#EF9F27";
  if (tss >= 50) return "#378ADD";
  return "#1D9E75";
}

function formatDistance(m: number): string {
  const km = m / 1000;
  return km >= 1 ? `${km.toFixed(1)} km` : `${Math.round(m)} m`;
}

function formatDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const ACTIVITY_ICONS: Record<string, string> = {
  Run: "🏃",
  Ride: "🚴",
  Swim: "🏊",
  Walk: "🚶",
  Hike: "🥾",
  WeightTraining: "🏋️",
};

export default function ActivityFeed({ activities }: Props) {
  return (
    <div className="bg-white rounded-2xl p-6"
      style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
        Recent Activities
      </h2>
      {activities.length === 0 ? (
        <p className="text-sm text-gray-400">No activities yet.</p>
      ) : (
        <div className="space-y-3">
          {activities.map((act) => (
            <div key={act.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">
                  {ACTIVITY_ICONS[act.type] ?? "🏅"}
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-800">{act.type}</p>
                  <p className="text-xs text-gray-400">
                    {formatDistance(act.distance_m)} · {formatDuration(act.duration_s)}
                    {act.avg_hr ? ` · ${act.avg_hr} bpm` : ""}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p
                  className="text-sm font-semibold"
                  style={{
                    color: tssColor(act.tss),
                    fontFamily: "var(--font-dm-mono)",
                  }}
                >
                  {Math.round(act.tss)} TSS
                </p>
                <p className="text-xs text-gray-400">{act.date}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
