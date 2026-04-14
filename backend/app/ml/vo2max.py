from typing import List, Optional

import numpy as np


def estimate_vo2max_from_run(
    distance_m: float,
    duration_s: int,
    avg_hr: int,
    max_hr: int = 190,
) -> Optional[float]:
    """
    Estimate VO2max from a single steady-state run using the ACSM running equation.
    Filters out short, stop-heavy, or HR-poor efforts.
    """
    if not distance_m or not duration_s or not avg_hr:
        return None
    if duration_s < 900 or distance_m < 2000:  # min 15 min / 2 km
        return None
    if avg_hr <= 0 or avg_hr >= max_hr:
        return None

    speed_m_per_min = distance_m / (duration_s / 60)

    # Reasonable running pace range (10:00/km to 3:30/km) — stricter than before
    if speed_m_per_min < 100 or speed_m_per_min > 286:
        return None

    # ACSM VO2 cost formula for running (ml/kg/min)
    vo2_at_speed = 0.2 * speed_m_per_min + 0.9 * 3.5 + 3.5

    # Intensity as fraction of HRmax — only use submaximal efforts
    intensity = avg_hr / max_hr
    if intensity < 0.50 or intensity > 0.95:
        return None

    vo2max = vo2_at_speed / intensity

    # Sanity bounds for humans
    if vo2max < 25 or vo2max > 80:
        return None

    return round(vo2max, 1)


def compute_vo2max_trend(activities: List[dict], max_hr: int = 190) -> dict:
    """
    Compute VO2max estimates from a list of run activities.
    Returns current estimate, trend, history, and contributing runs.
    """
    estimates = []

    for act in activities:
        if act.get("type") != "Run":
            continue

        dist = act.get("distance_m") or 0
        dur = act.get("duration_s") or 0
        hr = act.get("avg_hr") or 0

        est = estimate_vo2max_from_run(dist, dur, hr, max_hr)
        if est is not None:
            pace_s_per_km = dur / (dist / 1000) if dist > 0 else None
            estimates.append({
                "date": act["date"],
                "vo2max": est,
                "distance_km": round(dist / 1000, 1),
                "duration_s": dur,
                "avg_hr": hr,
                "pace_s_per_km": round(pace_s_per_km) if pace_s_per_km else None,
            })

    if not estimates:
        return {
            "current": None,
            "trend": None,
            "trend_value": None,
            "history": [],
            "fitness_age": None,
            "top_contributing_runs": [],
            "sample_size": 0,
            "confidence": "insufficient_data",
        }

    estimates.sort(key=lambda x: x["date"])

    # Rolling median over last 10 estimates for stability (more smoothing, less noise)
    recent = estimates[-10:]
    current_vo2max = round(float(np.median([e["vo2max"] for e in recent])), 1)

    # Best-effort estimate: 80th percentile of all estimates → used for race predictions
    all_vals = sorted([e["vo2max"] for e in estimates])
    p80_idx = max(0, int(len(all_vals) * 0.8) - 1)
    best_effort_vo2max = round(float(all_vals[p80_idx]), 1)

    # Trend: compare recent median to earlier window
    trend = None
    trend_value = None
    if len(estimates) >= 8:
        midpoint = max(0, len(estimates) - 16)
        older_window = estimates[midpoint: max(0, len(estimates) - 5)]
        if older_window:
            older_median = float(np.median([e["vo2max"] for e in older_window]))
            diff = current_vo2max - older_median
            trend_value = round(diff, 1)
            if diff > 1.0:
                trend = "improving"
            elif diff < -1.0:
                trend = "declining"
            else:
                trend = "stable"

    fitness_age = _estimate_fitness_age(current_vo2max)
    # Top runs = highest individual VO2max estimates (best efforts)
    top_runs = sorted(estimates, key=lambda x: x["vo2max"], reverse=True)[:5]

    confidence = "high" if len(estimates) >= 10 else "medium" if len(estimates) >= 5 else "low"

    return {
        "current": current_vo2max,
        "best_effort": best_effort_vo2max,
        "trend": trend,
        "trend_value": trend_value,
        "history": estimates,
        "fitness_age": fitness_age,
        "top_contributing_runs": top_runs,
        "sample_size": len(estimates),
        "confidence": confidence,
    }


def _estimate_fitness_age(vo2max: float) -> int:
    """
    Estimate fitness age from VO2max using normative data.
    Based on Cooper Institute standards (active male baseline).
    """
    age_norms = [
        (20, 56), (25, 54), (30, 52), (35, 49),
        (40, 47), (45, 44), (50, 41), (55, 38),
        (60, 35), (65, 32), (70, 29),
    ]
    for age, norm in age_norms:
        if vo2max >= norm:
            return age
    return 75
