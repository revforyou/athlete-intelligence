from typing import Optional

import numpy as np


def _percent_vo2max_at_time(t_minutes: float) -> float:
    """Daniels' formula: %VO2max utilizable at race of duration T minutes."""
    return (
        0.8
        + 0.1894393 * np.exp(-0.012778 * t_minutes)
        + 0.2989558 * np.exp(-0.1932605 * t_minutes)
    )


def predict_race_time_seconds(distance_m: float, vo2max: float) -> Optional[int]:
    """
    Predict race finish time in seconds for a given distance and VO2max.
    Uses Daniels' VDOT formula with binary search.
    """
    if vo2max <= 0 or distance_m <= 0:
        return None

    # Binary search for time T (minutes) such that:
    # VO2max * %VO2max(T) = VO2 at speed = D/T
    T_low, T_high = 0.5, 600.0

    for _ in range(80):
        T_mid = (T_low + T_high) / 2
        v = distance_m / T_mid  # m/min
        vo2_at_v = -4.60 + 0.182258 * v + 0.000104 * v ** 2
        pct = _percent_vo2max_at_time(T_mid)
        implied_vo2max = vo2_at_v / pct if pct > 0 else 999

        if implied_vo2max > vo2max:
            T_low = T_mid
        else:
            T_high = T_mid

    t_minutes = (T_low + T_high) / 2
    return round(t_minutes * 60)


def format_race_time(seconds: int) -> str:
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    if h > 0:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


def format_pace(distance_m: float, time_s: int) -> str:
    if distance_m <= 0 or time_s <= 0:
        return "—"
    pace_s = time_s / (distance_m / 1000)
    m = int(pace_s // 60)
    s = int(pace_s % 60)
    return f"{m}:{s:02d}/km"


def compute_race_predictions(vo2max: float) -> dict:
    """Generate race predictions for all standard distances."""
    distances = {
        "5K": 5000,
        "10K": 10000,
        "Half Marathon": 21097,
        "Marathon": 42195,
    }
    predictions = {}
    for name, dist_m in distances.items():
        t_s = predict_race_time_seconds(dist_m, vo2max)
        if t_s:
            predictions[name] = {
                "time": format_race_time(t_s),
                "seconds": t_s,
                "pace": format_pace(dist_m, t_s),
                "distance_m": dist_m,
            }
    return predictions


def pr_trajectory(
    current_vo2max: float,
    target_seconds: int,
    distance_m: float,
    weekly_vo2max_gain: float = 0.25,
) -> dict:
    """
    Estimate weeks to reach a target race time given current VO2max
    and a typical weekly VO2max improvement rate.
    """
    current_predicted = predict_race_time_seconds(distance_m, current_vo2max)
    if not current_predicted:
        return {"achievable_now": False, "weeks": None, "message": "Insufficient data"}

    if current_predicted <= target_seconds:
        return {
            "achievable_now": True,
            "weeks": 0,
            "current_seconds": current_predicted,
            "target_seconds": target_seconds,
            "gap_seconds": 0,
            "message": "You can achieve this goal now based on current fitness.",
        }

    gap = current_predicted - target_seconds
    projected_vo2max = current_vo2max
    weeks = 0
    while weeks < 52:
        weeks += 1
        projected_vo2max += weekly_vo2max_gain
        projected_time = predict_race_time_seconds(distance_m, projected_vo2max)
        if projected_time and projected_time <= target_seconds:
            break

    if weeks >= 52:
        return {
            "achievable_now": False,
            "weeks": None,
            "current_seconds": current_predicted,
            "target_seconds": target_seconds,
            "gap_seconds": gap,
            "message": "Goal may take over a year — consider an intermediate milestone.",
        }

    return {
        "achievable_now": False,
        "weeks": weeks,
        "current_seconds": current_predicted,
        "target_seconds": target_seconds,
        "gap_seconds": gap,
        "message": f"At current trajectory, ~{weeks} weeks away with consistent training.",
    }
