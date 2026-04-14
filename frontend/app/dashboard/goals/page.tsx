"use client";

import { useState, useEffect } from "react";
import { api, type GoalsData } from "@/lib/api";

const DISTANCES = ["5K", "10K", "Half Marathon", "Marathon"];

const COMMON_GOALS: Record<string, { label: string; time: string }[]> = {
  "5K": [
    { label: "Sub-20", time: "20:00" },
    { label: "Sub-25", time: "25:00" },
    { label: "Sub-30", time: "30:00" },
  ],
  "10K": [
    { label: "Sub-40", time: "40:00" },
    { label: "Sub-50", time: "50:00" },
    { label: "Sub-60", time: "60:00" },
  ],
  "Half Marathon": [
    { label: "Sub-1:45", time: "1:45:00" },
    { label: "Sub-2:00", time: "2:00:00" },
  ],
  "Marathon": [
    { label: "Sub-3:30", time: "3:30:00" },
    { label: "Sub-4:00", time: "4:00:00" },
  ],
};

export default function GoalsPage() {
  const [distance, setDistance] = useState("5K");
  const [targetTime, setTargetTime] = useState("");
  const [data, setData] = useState<GoalsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = async (dist: string, time: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getGoals(dist, time || undefined);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch(distance, "");
  }, []);

  const handleDistChange = (d: string) => {
    setDistance(d);
    setTargetTime("");
    fetch(d, "");
  };

  const handleGoalPreset = (time: string) => {
    setTargetTime(time);
    fetch(distance, time);
  };

  const traj = data?.trajectory;

  return (
    <div className="p-6 space-y-5 w-full">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Goals & PR Tracker</h1>
        <p className="text-sm text-gray-400 mt-0.5">How long until you hit your next PR?</p>
      </div>

      {/* Distance selector */}
      <div className="flex gap-2">
        {DISTANCES.map((d) => (
          <button key={d} onClick={() => handleDistChange(d)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              distance === d
                ? "bg-[#378ADD] text-white shadow-sm"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
            style={{ border: distance === d ? "none" : "0.5px solid rgba(0,0,0,0.08)" }}>
            {d}
          </button>
        ))}
      </div>

      {/* Current prediction */}
      {data && !loading && (
        <div className="bg-white rounded-2xl p-5" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            Your Current {distance} Prediction
          </p>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-5xl font-bold text-gray-900" style={{ fontFamily: "var(--font-dm-mono)" }}>
                {data.current_predicted_time ?? "—"}
              </p>
              <p className="text-xs text-gray-400 mt-1">{data.current_pace} avg pace</p>
            </div>
            <div className="text-right ml-auto">
              <p className="text-xs text-gray-500">VO2max</p>
              <p className="text-2xl font-bold text-[#378ADD]" style={{ fontFamily: "var(--font-dm-mono)" }}>
                {data.current_vo2max}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Goal presets */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
          Choose a goal
        </p>
        <div className="flex gap-2 flex-wrap">
          {(COMMON_GOALS[distance] ?? []).map(({ label, time }) => (
            <button key={label} onClick={() => handleGoalPreset(time)}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                targetTime === time
                  ? "bg-[#1D9E75] text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
              style={{ border: targetTime === time ? "none" : "0.5px solid rgba(0,0,0,0.08)" }}>
              {label}
              <span className="text-xs ml-1.5 opacity-70">{time}</span>
            </button>
          ))}

          {/* Custom input */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Custom: MM:SS or H:MM:SS"
              value={targetTime}
              onChange={(e) => setTargetTime(e.target.value)}
              className="border rounded-xl px-3 py-2 text-sm text-gray-700 w-48 focus:outline-none focus:ring-1 focus:ring-[#378ADD]"
              style={{ borderColor: "rgba(0,0,0,0.12)" }}
            />
            <button
              onClick={() => fetch(distance, targetTime)}
              className="px-3 py-2 bg-[#378ADD] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer">
              Set Goal
            </button>
          </div>
        </div>
      </div>

      {/* Trajectory result */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-50 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      ) : traj && targetTime ? (
        <div className={`rounded-2xl p-6 ${
          traj.achievable_now ? "bg-green-50 border border-green-200"
          : "bg-white"
        }`} style={!traj.achievable_now ? { border: "0.5px solid rgba(0,0,0,0.08)" } : {}}>
          <div className="flex items-start gap-4">
            <span className="text-3xl">
              {traj.achievable_now ? "🏆" : traj.weeks === null ? "📅" : "🎯"}
            </span>
            <div>
              <p className="text-lg font-bold text-gray-900 mb-1">{traj.message}</p>
              {!traj.achievable_now && traj.weeks !== null && (
                <div className="space-y-1 mt-2">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <span>Current predicted:</span>
                    <span className="font-semibold text-gray-900" style={{ fontFamily: "var(--font-dm-mono)" }}>
                      {data?.current_predicted_time}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <span>Target:</span>
                    <span className="font-semibold text-gray-900" style={{ fontFamily: "var(--font-dm-mono)" }}>
                      {targetTime}
                    </span>
                  </div>
                  {traj.gap_seconds > 0 && (
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <span>Gap to close:</span>
                      <span className="font-semibold text-gray-900" style={{ fontFamily: "var(--font-dm-mono)" }}>
                        {Math.floor(traj.gap_seconds / 60)}m {traj.gap_seconds % 60}s
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* All distances table */}
      {data?.all_predictions && (
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
          <div className="px-5 py-3 border-b" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              All Race Predictions
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "rgba(0,0,0,0.04)" }}>
                {["Distance", "Predicted Time", "Avg Pace"].map((h) => (
                  <th key={h} className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DISTANCES.map((d) => {
                const p = data.all_predictions[d];
                if (!p) return null;
                return (
                  <tr key={d} className={`border-b last:border-0 ${d === distance ? "bg-[#F0F6FF]" : "hover:bg-gray-50"}`}
                    style={{ borderColor: "rgba(0,0,0,0.04)" }}>
                    <td className="px-5 py-3 text-sm font-medium text-gray-900">{d}</td>
                    <td className="px-5 py-3 text-sm font-bold text-gray-900" style={{ fontFamily: "var(--font-dm-mono)" }}>
                      {p.time}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500">{p.pace}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-gray-50 rounded-xl px-4 py-3" style={{ border: "0.5px solid rgba(0,0,0,0.06)" }}>
        <p className="text-[11px] text-gray-500 leading-relaxed">
          <span className="font-semibold">Trajectory assumption:</span> 0.25 VO2max points per week improvement
          with consistent training. Actual improvement depends on training quality, recovery, and individual response.
        </p>
      </div>
    </div>
  );
}
