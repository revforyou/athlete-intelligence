from datetime import date, timedelta
from typing import List, Optional

import numpy as np


# Z1–Z5 thresholds as fraction of max_hr
ZONE_THRESHOLDS = [0.60, 0.70, 0.80, 0.90]  # boundaries between Z1/Z2, Z2/Z3, Z3/Z4, Z4/Z5


def classify_hr_to_zone(hr: int, max_hr: int) -> int:
    pct = hr / max_hr
    if pct < ZONE_THRESHOLDS[0]:
        return 1
    elif pct < ZONE_THRESHOLDS[1]:
        return 2
    elif pct < ZONE_THRESHOLDS[2]:
        return 3
    elif pct < ZONE_THRESHOLDS[3]:
        return 4
    return 5


def compute_zone_minutes(
    heartrate: List[int],
    timestamps: List[int],
    max_hr: int,
) -> dict:
    zone_seconds = {1: 0.0, 2: 0.0, 3: 0.0, 4: 0.0, 5: 0.0}

    for i in range(len(heartrate)):
        hr = heartrate[i]
        if i < len(timestamps) - 1:
            dt = timestamps[i + 1] - timestamps[i]
        else:
            dt = 1  # assume 1s for last sample
        zone = classify_hr_to_zone(hr, max_hr)
        zone_seconds[zone] += dt

    return {f"z{z}_mins": round(secs / 60, 2) for z, secs in zone_seconds.items()}


def compute_polarization_score(zone_mins: dict) -> float:
    total = sum(zone_mins.values())
    if total == 0:
        return 0.0
    hard = zone_mins.get("z4_mins", 0) + zone_mins.get("z5_mins", 0)
    return round(hard / total * 100, 2)


def compute_weekly_zones(activity_zones: List[dict]) -> dict:
    totals = {"z1_mins": 0.0, "z2_mins": 0.0, "z3_mins": 0.0, "z4_mins": 0.0, "z5_mins": 0.0}
    for az in activity_zones:
        for key in totals:
            totals[key] += az.get(key, 0)
    totals["polarization_score"] = compute_polarization_score(totals)
    return totals


def detect_zone_drift(
    current_week: dict,
    baseline_weeks: List[dict],
    threshold_pct: float = 15.0,
) -> Optional[str]:
    if len(baseline_weeks) < 2:
        return None

    baseline_total = sum(
        w.get("z4_mins", 0) + w.get("z5_mins", 0) for w in baseline_weeks
    ) / len(baseline_weeks)
    current_hard = current_week.get("z4_mins", 0) + current_week.get("z5_mins", 0)

    baseline_total_mins = sum(
        sum(w.get(k, 0) for k in ["z1_mins", "z2_mins", "z3_mins", "z4_mins", "z5_mins"])
        for w in baseline_weeks
    ) / len(baseline_weeks)

    if baseline_total_mins == 0:
        return None

    baseline_pct = (baseline_total / baseline_total_mins) * 100
    current_total_mins = sum(current_week.get(k, 0) for k in ["z1_mins", "z2_mins", "z3_mins", "z4_mins", "z5_mins"])
    if current_total_mins == 0:
        return None

    current_pct = (current_hard / current_total_mins) * 100
    delta = abs(current_pct - baseline_pct)
    if delta > threshold_pct:
        direction = "increase" if current_pct > baseline_pct else "decrease"
        return f"Zone distribution shifted {delta:.1f}% ({direction} in hard training)"
    return None
