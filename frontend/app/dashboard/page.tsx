"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { api, type TodayScore, type ZoneWeek, type DailyFeature, type Activity } from "@/lib/api";
import RiskDial from "@/components/RiskDial";
import ZoneChart from "@/components/ZoneChart";
import LoadChart from "@/components/LoadChart";
import DriftAlert from "@/components/DriftAlert";
import FeedbackWidget from "@/components/FeedbackWidget";
import CalibrationBadge from "@/components/CalibrationBadge";
import ActivityFeed from "@/components/ActivityFeed";

interface DriftEvent {
  psi_score: number;
  feature_name: string;
}

export default function Dashboard() {
  const params = useSearchParams();

  const [score, setScore] = useState<TodayScore | null>(null);
  const [zones, setZones] = useState<ZoneWeek[]>([]);
  const [features, setFeatures] = useState<DailyFeature[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [drift, setDrift] = useState<DriftEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [scoreData, zonesData, featuresData, activitiesData] = await Promise.all([
        api.getTodayScore(),
        api.getWeeklyZones(),
        api.getFeatures(),
        api.getActivities(),
      ]);
      setScore(scoreData);
      setZones(zonesData);
      setFeatures(featuresData);
      setActivities(activitiesData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = params.get("token");
    if (token) {
      localStorage.setItem("ai_token", token);
      // Clean URL
      window.history.replaceState({}, "", "/dashboard");
    }
    loadData();
  }, [params, loadData]);

  // Count consecutive training days
  const consecutiveDays = (() => {
    if (!activities.length) return 0;
    const sorted = [...activities].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    let count = 0;
    let prev: Date | null = null;
    for (const act of sorted) {
      const d = new Date(act.date);
      if (!prev) {
        prev = d;
        count = 1;
      } else {
        const diff = (prev.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
        if (diff <= 1) {
          count++;
          prev = d;
        } else break;
      }
    }
    return count;
  })();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F4F1] flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading your data…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F5F4F1] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 text-sm">{error}</p>
          <button
            onClick={() => { window.location.href = "/"; }}
            className="mt-4 text-xs text-gray-500 underline cursor-pointer"
          >
            Back to home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F4F1]">
      {/* Header */}
      <header
        className="bg-white px-6 py-4 flex items-center justify-between sticky top-0 z-10"
        style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}
      >
        <h1 className="text-base font-semibold">Athlete Intelligence</h1>
        {score?.calibration && (
          <CalibrationBadge
            nObservations={
              score.calibration.confidence === "high"
                ? 8
                : score.calibration.confidence === "medium"
                ? 5
                : 2
            }
            message={score.calibration.message}
            confidence={score.calibration.confidence as "low" | "medium" | "high"}
          />
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        {/* Drift alert — full width */}
        {drift && (
          <DriftAlert psiScore={drift.psi_score} featureName={drift.feature_name} />
        )}

        {/* Recommendation banner */}
        {score?.recommendation && (
          <div
            className="w-full bg-white rounded-2xl px-6 py-4 flex items-start gap-4"
            style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}
          >
            <span className="text-2xl mt-0.5">
              {score.recommendation.action === "rest"
                ? "🛋️"
                : score.recommendation.action === "easy"
                ? "🚶"
                : "✅"}
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                Today&apos;s Recommendation
              </p>
              <p className="text-sm text-gray-800 leading-relaxed">
                {score.recommendation.text}
              </p>
            </div>
          </div>
        )}

        {/* 3-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Column 1 */}
          <div className="space-y-4">
            {score && (
              <RiskDial
                score={score.score}
                confidence={score.calibration?.confidence}
              />
            )}
            {score?.top_factors && score.top_factors.length > 0 && (
              <div
                className="bg-white rounded-2xl p-6"
                style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}
              >
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Top Risk Factors
                </h2>
                <div className="space-y-2">
                  {score.top_factors.map((f) => (
                    <div key={f.name} className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 capitalize">
                        {f.name.replace(/_/g, " ")}
                      </span>
                      <span
                        className="text-xs font-semibold"
                        style={{
                          color: f.shap > 0 ? "#E8593C" : "#1D9E75",
                          fontFamily: "var(--font-dm-mono)",
                        }}
                      >
                        {f.shap > 0 ? "+" : ""}
                        {f.shap.toFixed(3)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <FeedbackWidget
              consecutiveTrainingDays={consecutiveDays}
              riskScore={score?.score}
            />
          </div>

          {/* Column 2 */}
          <div className="space-y-4">
            {features.length > 0 && <LoadChart data={features} />}
            {activities.length > 0 && <ActivityFeed activities={activities} />}
          </div>

          {/* Column 3 */}
          <div className="space-y-4">
            {zones.length > 0 && <ZoneChart data={zones} />}
          </div>
        </div>
      </main>
    </div>
  );
}
