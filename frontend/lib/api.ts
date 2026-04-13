const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ai_token");
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers ?? {}),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const json = await res.json();

  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `HTTP ${res.status}`);
  }

  return json.data as T;
}

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

export interface AthleteMe {
  id: string;
  strava_id: number;
  name: string | null;
  email: string | null;
  max_hr: number;
  created_at: string;
}

export const api = {
  getMe: () => apiFetch<AthleteMe>("/api/athletes/me"),
  getFeatures: () => apiFetch<DailyFeature[]>("/api/athletes/me/features"),
  getTodayScore: () => apiFetch<TodayScore>("/api/scores/today"),
  getScoreHistory: () => apiFetch<ScoreHistory[]>("/api/scores/history"),
  getWeeklyZones: () => apiFetch<ZoneWeek[]>("/api/zones/weekly"),
  getActivities: () => apiFetch<Activity[]>("/api/activities"),
  submitFeedback: (rating: string, riskScore?: number) =>
    apiFetch("/api/feedback", {
      method: "POST",
      body: JSON.stringify({ rating, risk_score_at_time: riskScore }),
    }),
  stravaAuthorize: () => {
    window.location.href = `${API_BASE}/auth/strava/authorize`;
  },
};
