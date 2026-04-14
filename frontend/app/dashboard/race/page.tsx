"use client";

import { useEffect, useState } from "react";
import { api, type RacePredictionsData, type GoalsData } from "@/lib/api";

// ─── Shared helpers ────────────────────────────────────────────────────────

const DIST_ORDER = ["5K", "10K", "Half Marathon", "Marathon"];
const DIST_EMOJIS: Record<string, string> = {
  "5K": "🏃", "10K": "⚡", "Half Marathon": "🌅", "Marathon": "🏆",
};
const COMMON_GOALS: Record<string, { label: string; time: string }[]> = {
  "5K":           [{ label: "Sub-20", time: "20:00" }, { label: "Sub-25", time: "25:00" }, { label: "Sub-30", time: "30:00" }],
  "10K":          [{ label: "Sub-40", time: "40:00" }, { label: "Sub-50", time: "50:00" }, { label: "Sub-60", time: "60:00" }],
  "Half Marathon":[{ label: "Sub-1:45", time: "1:45:00" }, { label: "Sub-2:00", time: "2:00:00" }],
  "Marathon":     [{ label: "Sub-3:30", time: "3:30:00" }, { label: "Sub-4:00", time: "4:00:00" }],
};

function weeksColor(weeks: number | null) {
  if (weeks === null) return "#9CA3AF";
  if (weeks <= 8) return "#1D9E75";
  if (weeks <= 20) return "#EF9F27";
  return "#E8593C";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RacePage() {
  // Race predictions state
  const [preds, setPreds] = useState<RacePredictionsData | null>(null);
  const [predsLoading, setPredsLoading] = useState(true);
  const [predsError, setPredsError] = useState<string | null>(null);

  // Goal state
  const [distance, setDistance] = useState("5K");
  const [targetTime, setTargetTime] = useState("");
  const [goalData, setGoalData] = useState<GoalsData | null>(null);
  const [goalLoading, setGoalLoading] = useState(false);

  useEffect(() => {
    api.getRacePredictions()
      .then(setPreds)
      .catch((e) => setPredsError(e.message))
      .finally(() => setPredsLoading(false));

    // Load initial goal data
    api.getGoals("5K").then(setGoalData).catch(() => {});
  }, []);

  const fetchGoal = (dist: string, time: string) => {
    setGoalLoading(true);
    api.getGoals(dist, time || undefined)
      .then(setGoalData)
      .finally(() => setGoalLoading(false));
  };

  const handleDistChange = (d: string) => {
    setDistance(d);
    setTargetTime("");
    fetchGoal(d, "");
  };

  const handlePreset = (time: string) => {
    setTargetTime(time);
    fetchGoal(distance, time);
  };

  const traj = goalData?.trajectory;

  return (
    <div className="p-6 space-y-6 w-full">

      {/* ── Section 1: Race Predictions ── */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Races & Goals</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Predicted finish times + how long until your next PR
        </p>
      </div>

      {predsLoading ? (
        <div className="flex items-center justify-center py-14">
          <div className="w-7 h-7 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
        </div>
      ) : predsError ? (
        <div className="bg-white rounded-2xl p-8 text-center" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
          <p className="text-gray-400 text-sm">{predsError}</p>
          <p className="text-gray-400 text-xs mt-1">Log more qualifying runs (15+ min with HR data) to unlock predictions.</p>
        </div>
      ) : preds ? (
        <>
          {/* VO2max context pill */}
          <div className="flex items-center gap-3 bg-[#F0F6FF] rounded-xl px-4 py-3"
            style={{ border: "0.5px solid #C7DCFB" }}>
            <span className="text-xl">⚡</span>
            <div>
              <p className="text-sm font-semibold text-gray-800">
                Best-effort VO2max: {preds.best_effort_vo2max ?? preds.vo2max} ml/kg/min
              </p>
              <p className="text-xs text-gray-500">
                {preds.vo2max_confidence} confidence · predictions based on your peak qualifying runs
              </p>
            </div>
          </div>

          {/* 4 race cards */}
          <div className="grid grid-cols-4 gap-3">
            {DIST_ORDER.map((dist) => {
              const pred = preds.predictions[dist];
              if (!pred) return null;
              const traj_for_dist = preds.trajectories[dist] as unknown as
                Array<{ label: string; target_time: string; achievable_now: boolean; weeks: number | null }>;
              return (
                <div key={dist} className="bg-white rounded-2xl p-4"
                  style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">{DIST_EMOJIS[dist]}</span>
                    <p className="text-xs font-semibold text-gray-500">{dist}</p>
                  </div>
                  <p className="text-3xl font-bold text-gray-900" style={{ fontFamily: "var(--font-dm-mono)" }}>
                    {pred.time}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{pred.pace} avg</p>

                  {/* Common goals for this distance */}
                  {traj_for_dist && (
                    <div className="mt-3 pt-3 space-y-1.5 border-t" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
                      {traj_for_dist.map((g) => (
                        <div key={g.label} className="flex items-center justify-between">
                          <span className="text-[10px] text-gray-500">{g.label}</span>
                          <span className="text-[10px] font-semibold"
                            style={{ color: g.achievable_now ? "#1D9E75" : weeksColor(g.weeks) }}>
                            {g.achievable_now ? "Now ✓" : g.weeks ? `~${g.weeks}w` : ">1yr"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {/* ── Divider ── */}
      <div className="border-t" style={{ borderColor: "rgba(0,0,0,0.07)" }} />

      {/* ── Section 2: PR Goal Tracker ── */}
      <div>
        <h2 className="text-base font-bold text-gray-900">PR Goal Tracker</h2>
        <p className="text-sm text-gray-400 mt-0.5">Pick a distance and target — see how many weeks away you are</p>
      </div>

      {/* Distance tabs */}
      <div className="flex gap-2">
        {DIST_ORDER.map((d) => (
          <button key={d} onClick={() => handleDistChange(d)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              distance === d ? "bg-[#378ADD] text-white" : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
            style={{ border: distance === d ? "none" : "0.5px solid rgba(0,0,0,0.08)" }}>
            {d}
          </button>
        ))}
      </div>

      {/* Current prediction for selected distance */}
      {goalData && (
        <div className="bg-white rounded-xl px-5 py-4 flex items-center justify-between"
          style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Your current {distance} prediction
            </p>
            <p className="text-3xl font-bold text-gray-900 mt-1" style={{ fontFamily: "var(--font-dm-mono)" }}>
              {goalData.current_predicted_time ?? "—"}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{goalData.current_pace} avg pace</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-400">VO2max estimate</p>
            <p className="text-2xl font-bold text-[#378ADD]" style={{ fontFamily: "var(--font-dm-mono)" }}>
              {goalData.current_vo2max}
            </p>
          </div>
        </div>
      )}

      {/* Goal presets + custom input */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Set a goal</p>
        <div className="flex flex-wrap gap-2 items-center">
          {(COMMON_GOALS[distance] ?? []).map(({ label, time }) => (
            <button key={label} onClick={() => handlePreset(time)}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                targetTime === time ? "bg-[#1D9E75] text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
              style={{ border: targetTime === time ? "none" : "0.5px solid rgba(0,0,0,0.08)" }}>
              {label}
              <span className="text-xs ml-1.5 opacity-70">{time}</span>
            </button>
          ))}
          <input
            type="text"
            placeholder="Custom (MM:SS or H:MM:SS)"
            value={targetTime}
            onChange={(e) => setTargetTime(e.target.value)}
            className="border rounded-xl px-3 py-2 text-sm text-gray-700 w-44 focus:outline-none focus:ring-1 focus:ring-[#378ADD]"
            style={{ borderColor: "rgba(0,0,0,0.12)" }}
          />
          <button onClick={() => fetchGoal(distance, targetTime)}
            className="px-4 py-2 bg-[#378ADD] text-white rounded-xl text-sm font-medium hover:opacity-90 cursor-pointer">
            Go
          </button>
        </div>
      </div>

      {/* Trajectory result */}
      {goalLoading ? (
        <div className="flex items-center justify-center py-6">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
        </div>
      ) : traj && targetTime ? (
        <div className={`rounded-2xl p-5 ${traj.achievable_now
          ? "bg-green-50 border border-green-200"
          : "bg-white"}`}
          style={!traj.achievable_now ? { border: "0.5px solid rgba(0,0,0,0.08)" } : {}}>
          <div className="flex items-start gap-4">
            <span className="text-3xl">
              {traj.achievable_now ? "🏆" : traj.weeks === null ? "📅" : "🎯"}
            </span>
            <div className="flex-1">
              <p className="text-base font-bold text-gray-900">{traj.message}</p>
              {!traj.achievable_now && traj.weeks !== null && (
                <div className="mt-3 grid grid-cols-3 gap-3">
                  {[
                    { label: "Current", val: goalData?.current_predicted_time ?? "—" },
                    { label: "Target", val: targetTime },
                    { label: "Gap", val: traj.gap_seconds > 0 ? `${Math.floor(traj.gap_seconds / 60)}m ${traj.gap_seconds % 60}s` : "0" },
                  ].map(({ label, val }) => (
                    <div key={label} className="bg-white rounded-xl p-3 text-center"
                      style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
                      <p className="text-sm font-bold text-gray-900 mt-1" style={{ fontFamily: "var(--font-dm-mono)" }}>{val}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Methodology note */}
      <div className="bg-gray-50 rounded-xl px-4 py-3" style={{ border: "0.5px solid rgba(0,0,0,0.06)" }}>
        <p className="text-[11px] text-gray-500 leading-relaxed">
          <span className="font-semibold">Predictions:</span> Daniels&apos; VDOT formula — finds the race time where VO2 demand equals your estimated VO2max at that duration. Based on your best qualifying runs.
          <span className="font-semibold ml-2">Trajectory:</span> Assumes 0.25 VO2max pts/week improvement with consistent training.
        </p>
      </div>
    </div>
  );
}
