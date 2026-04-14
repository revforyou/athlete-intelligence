const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options?.headers ?? {}),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
  const json = await res.json();

  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `HTTP ${res.status}`);
  }

  return json.data as T;
}

// ─── Existing interfaces ───────────────────────────────────────────────────

export interface TodayScore {
  score: number;
  raw_score: number;
  top_factors: { name: string; value: number; shap: number }[];
  model_version: string;
  calibration: { score: number; confidence: string; message: string };
  recommendation: { text: string; action: string } | null;
}

export interface ScoreHistory {
  date: string;
  score: number;
  top_factors: { name: string; value: number; shap: number }[];
  model_version: string;
}

export interface ZoneWeek {
  week_start: string;
  z1_mins: number;
  z2_mins: number;
  z3_mins: number;
  z4_mins: number;
  z5_mins: number;
  polarization_score: number;
}

export interface DailyFeature {
  date: string;
  atl: number;
  ctl: number;
  tsb: number;
  acwr: number;
  monotony: number;
  strain: number;
}

export interface Activity {
  id: string;
  type: string;
  distance_m: number;
  duration_s: number;
  avg_hr: number;
  tss: number;
  date: string;
}

export interface ActivityStats {
  period: string;
  sport: string;
  total_sessions: number;
  total_distance_km: number;
  total_duration_s: number;
  total_tss: number;
  avg_hr: number | null;
  avg_pace_s_per_km: number | null;
  by_sport: Record<string, { sessions: number; distance_m: number; duration_s: number; tss: number }>;
  daily_tss: Record<string, number>;
}

export interface AthleteMe {
  id: string;
  strava_id: number;
  name: string | null;
  email: string | null;
  max_hr: number;
  created_at: string;
}

// ─── Analytics interfaces ──────────────────────────────────────────────────

export interface TrainingPhase {
  phase: string;
  emoji: string;
  confidence: string;
  reasoning: string;
  guidance: string;
  metrics: {
    ctl: number;
    atl: number;
    tsb: number;
    acwr: number;
    ctl_trend_4w: number;
    tsb_trend_1w: number;
  };
  history?: { date: string; phase: string; emoji: string }[];
}

export interface OverviewData {
  risk: {
    score: number | null;
    raw_score: number | null;
    top_factors: { name: string; value: number; shap: number }[];
    calibration: { score: number; confidence: string; message: string } | null;
    as_of: string | null;
  };
  phase: TrainingPhase;
  recommendation: { text: string; action: string; date: string } | null;
  metrics: DailyFeature | null;
  tss_sparkline: Record<string, number>;
}

export interface WeekStats {
  week_start: string;
  sessions: number;
  distance_km: number;
  duration_s: number;
  tss: number;
  elevation_m: number;
  avg_hr: number | null;
  avg_pace_s_per_km: number | null;
}

export interface RunningData {
  weeks: WeekStats[];
  summary: {
    total_sessions: number;
    total_distance_km: number;
    total_duration_s: number;
    total_elevation_m: number;
    longest_run_km: number;
    avg_weekly_km: number;
    pace_trend: "improving" | "stable" | "declining" | null;
    first_half_pace_s_per_km: number | null;
    second_half_pace_s_per_km: number | null;
  } | null;
}

export interface VO2maxEstimate {
  date: string;
  vo2max: number;
  distance_km: number;
  duration_s: number;
  avg_hr: number;
  pace_s_per_km: number | null;
}

export interface RacePrediction {
  time: string;
  seconds: number;
  pace: string;
  distance_m: number;
}

export interface VO2maxData {
  current: number | null;
  trend: "improving" | "stable" | "declining" | null;
  trend_value: number | null;
  history: VO2maxEstimate[];
  fitness_age: number | null;
  top_contributing_runs: VO2maxEstimate[];
  sample_size: number;
  confidence: string;
  race_predictions: Record<string, RacePrediction> | null;
  max_hr_used: number;
}

export interface PRTrajectory {
  achievable_now: boolean;
  weeks: number | null;
  current_seconds: number;
  target_seconds: number;
  gap_seconds: number;
  message: string;
}

export interface RacePredictionsData {
  vo2max: number;
  best_effort_vo2max?: number;
  vo2max_confidence: string;
  predictions: Record<string, RacePrediction>;
  trajectories: Record<string, { label: string; target_time: string } & PRTrajectory[]>;
}

export interface HeartRateData {
  zone_weeks: ZoneWeek[];
  latest_zones: ZoneWeek | null;
  avg_polarization_4w: number | null;
  hr_trend: { week_start: string; avg_hr: number }[];
  flags: { type: string; message: string }[];
  max_hr: number;
  zone_thresholds: Record<string, string>;
}

export interface TrainingLoadData {
  history: DailyFeature[];
  current: {
    atl: number;
    ctl: number;
    tsb: number;
    acwr: number;
    monotony: number;
    strain: number;
  };
  acwr_bands: { label: string; min: number; max: number; color: string }[];
  flags: { type: string; field: string; message: string }[];
}

export interface GoalsData {
  distance: string;
  current_vo2max: number;
  current_predicted_time: string | null;
  current_predicted_seconds: number | null;
  current_pace: string | null;
  target_time: string | null;
  target_seconds: number | null;
  trajectory: PRTrajectory | null;
  all_predictions: Record<string, RacePrediction>;
}

// ─── API methods ───────────────────────────────────────────────────────────

export const api = {
  // Existing
  getMe: () => apiFetch<AthleteMe>("/api/athletes/me"),
  getFeatures: () => apiFetch<DailyFeature[]>("/api/athletes/me/features"),
  getTodayScore: () => apiFetch<TodayScore>("/api/scores/today"),
  getScoreHistory: () => apiFetch<ScoreHistory[]>("/api/scores/history"),
  getWeeklyZones: () => apiFetch<ZoneWeek[]>("/api/zones/weekly"),
  getActivities: (sport?: string, limit = 10) =>
    apiFetch<Activity[]>(`/api/activities${sport ? `?sport=${sport}&limit=${limit}` : `?limit=${limit}`}`),
  getActivityTypes: () => apiFetch<string[]>("/api/activities/types"),
  getActivityStats: (sport?: string, period: "weekly" | "monthly" = "weekly") =>
    apiFetch<ActivityStats>(`/api/activities/stats?period=${period}${sport && sport !== "All" ? `&sport=${sport}` : ""}`),
  submitFeedback: (rating: string, riskScore?: number) =>
    apiFetch("/api/feedback", {
      method: "POST",
      body: JSON.stringify({ rating, risk_score_at_time: riskScore }),
    }),
  stravaAuthorize: () => {
    window.location.href = `${API_BASE}/auth/strava/authorize`;
  },

  // Analytics
  getOverview: () => apiFetch<OverviewData>("/api/analytics/overview"),
  getRunning: (weeks = 8) => apiFetch<RunningData>(`/api/analytics/running?weeks=${weeks}`),
  getVO2max: () => apiFetch<VO2maxData>("/api/analytics/vo2max"),
  getRacePredictions: () => apiFetch<RacePredictionsData>("/api/analytics/race-predictions"),
  getHeartRate: (weeks = 8) => apiFetch<HeartRateData>(`/api/analytics/heart-rate?weeks=${weeks}`),
  getTrainingLoad: (days = 42) => apiFetch<TrainingLoadData>(`/api/analytics/training-load?days=${days}`),
  getPhase: () => apiFetch<TrainingPhase>("/api/analytics/phase"),
  getGoals: (distance = "5K", targetTime?: string) =>
    apiFetch<GoalsData>(
      `/api/analytics/goals?distance=${encodeURIComponent(distance)}${targetTime ? `&target_time=${encodeURIComponent(targetTime)}` : ""}`
    ),
};
