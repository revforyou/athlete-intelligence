from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_athlete
from app.core.database import get_db
from app.ml.bayesian import get_calibrated_score
from app.ml.race_predictor import compute_race_predictions, pr_trajectory, format_race_time
from app.ml.training_phase import classify_training_phase
from app.ml.vo2max import compute_vo2max_trend
from app.models.athlete import Athlete

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _fetch_features_history(db, athlete_id: str, days: int = 90) -> list:
    since = (date.today() - timedelta(days=days)).isoformat()
    result = (
        await db.table("daily_features")
        .select("date,atl,ctl,tsb,acwr,monotony,strain")
        .eq("athlete_id", athlete_id)
        .gte("date", since)
        .order("date", desc=False)
        .execute()
    )
    return result.data or []


async def _fetch_run_activities(db, athlete_id: str, days: int = 90) -> list:
    since = (date.today() - timedelta(days=days)).isoformat()
    result = (
        await db.table("activities")
        .select("id,type,distance_m,duration_s,avg_hr,tss,date,elevation_m")
        .eq("athlete_id", athlete_id)
        .eq("type", "Run")
        .gte("date", since)
        .order("date", desc=False)
        .execute()
    )
    return result.data or []


# ---------------------------------------------------------------------------
# /api/analytics/overview
# ---------------------------------------------------------------------------

@router.get("/overview")
async def get_overview(athlete: Athlete = Depends(get_current_athlete)):
    """
    Lightweight decision surface: risk score, training phase, today's recommendation,
    key metric snapshot, and last 7 days of TSS.
    """
    db = await get_db()
    athlete_id = str(athlete.id)
    today = date.today().isoformat()

    # Risk score (cached)
    score_result = (
        await db.table("risk_scores")
        .select("score,top_factors,date")
        .eq("athlete_id", athlete_id)
        .order("date", desc=True)
        .limit(1)
        .execute()
    )
    score_row = score_result.data[0] if score_result.data else None

    # Calibration
    model_state_result = (
        await db.table("athlete_model_state")
        .select("alpha,beta,n_observations")
        .eq("athlete_id", athlete_id)
        .execute()
    )
    state = model_state_result.data[0] if model_state_result.data else {"alpha": 2.0, "beta": 2.0, "n_observations": 0}
    calibration = get_calibrated_score(state, score_row["score"]) if score_row else None

    # Today's recommendation
    rec_result = (
        await db.table("recommendations")
        .select("text,action,date")
        .eq("athlete_id", athlete_id)
        .eq("date", today)
        .execute()
    )
    recommendation = rec_result.data[0] if rec_result.data else None

    # Latest features snapshot
    features_result = (
        await db.table("daily_features")
        .select("date,atl,ctl,tsb,acwr,monotony,strain")
        .eq("athlete_id", athlete_id)
        .order("date", desc=True)
        .limit(1)
        .execute()
    )
    latest_features = features_result.data[0] if features_result.data else None

    # Training phase (needs history)
    features_history = await _fetch_features_history(db, athlete_id, days=60)
    phase = classify_training_phase(features_history)

    # Last 7 days TSS sparkline
    week_ago = (date.today() - timedelta(days=7)).isoformat()
    tss_result = (
        await db.table("activities")
        .select("date,tss,type")
        .eq("athlete_id", athlete_id)
        .gte("date", week_ago)
        .order("date", desc=False)
        .execute()
    )
    daily_tss: dict = {}
    for a in tss_result.data or []:
        d = a["date"]
        daily_tss[d] = round((daily_tss.get(d) or 0) + (a.get("tss") or 0), 1)

    return {
        "data": {
            "risk": {
                "score": calibration["score"] if calibration else None,
                "raw_score": score_row["score"] if score_row else None,
                "top_factors": score_row["top_factors"] if score_row else [],
                "calibration": calibration,
                "as_of": score_row["date"] if score_row else None,
            },
            "phase": phase,
            "recommendation": recommendation,
            "metrics": latest_features,
            "tss_sparkline": daily_tss,
        },
        "error": None,
    }


# ---------------------------------------------------------------------------
# /api/analytics/running
# ---------------------------------------------------------------------------

@router.get("/running")
async def get_running_metrics(
    weeks: int = Query(8, ge=1, le=52),
    athlete: Athlete = Depends(get_current_athlete),
):
    """
    Running-specific metrics: weekly mileage, pace trend, elevation trend,
    session counts, longest run, and per-week breakdown.
    """
    db = await get_db()
    athlete_id = str(athlete.id)
    days = weeks * 7
    activities = await _fetch_run_activities(db, athlete_id, days=days)

    if not activities:
        return {"data": {"weeks": [], "summary": None}, "error": None}

    # Group by ISO week
    from collections import defaultdict
    weekly: dict = defaultdict(lambda: {
        "sessions": 0, "distance_m": 0.0, "duration_s": 0,
        "tss": 0.0, "elevation_m": 0.0, "hr_sum": 0, "hr_count": 0,
        "pace_dist": 0.0, "pace_time": 0,
    })

    all_runs_for_pace = []
    for a in activities:
        d = date.fromisoformat(a["date"])
        # Monday of that week
        week_start = (d - timedelta(days=d.weekday())).isoformat()
        w = weekly[week_start]
        w["sessions"] += 1
        w["distance_m"] += a.get("distance_m") or 0
        w["duration_s"] += a.get("duration_s") or 0
        w["tss"] += a.get("tss") or 0
        w["elevation_m"] += a.get("elevation_m") or 0
        if a.get("avg_hr"):
            w["hr_sum"] += a["avg_hr"]
            w["hr_count"] += 1
        dist = a.get("distance_m") or 0
        dur = a.get("duration_s") or 0
        if dist > 0 and dur > 0:
            w["pace_dist"] += dist
            w["pace_time"] += dur
            all_runs_for_pace.append({"dist": dist, "dur": dur, "date": a["date"]})

    weeks_data = []
    for week_start in sorted(weekly.keys()):
        w = weekly[week_start]
        pace_s_per_km = (
            round(w["pace_time"] / (w["pace_dist"] / 1000))
            if w["pace_dist"] > 0 else None
        )
        weeks_data.append({
            "week_start": week_start,
            "sessions": w["sessions"],
            "distance_km": round(w["distance_m"] / 1000, 1),
            "duration_s": w["duration_s"],
            "tss": round(w["tss"], 1),
            "elevation_m": round(w["elevation_m"], 0),
            "avg_hr": round(w["hr_sum"] / w["hr_count"]) if w["hr_count"] else None,
            "avg_pace_s_per_km": pace_s_per_km,
        })

    # Summary across full period
    total_dist = sum(a.get("distance_m") or 0 for a in activities)
    total_dur = sum(a.get("duration_s") or 0 for a in activities)
    total_elev = sum(a.get("elevation_m") or 0 for a in activities)
    longest_run = max((a.get("distance_m") or 0) for a in activities) / 1000

    # Pace trend: compare first half vs second half of period
    mid = len(all_runs_for_pace) // 2
    def _median_pace(runs):
        paces = [r["dur"] / (r["dist"] / 1000) for r in runs if r["dist"] > 0]
        return round(float(sorted(paces)[len(paces) // 2])) if paces else None

    first_half_pace = _median_pace(all_runs_for_pace[:mid]) if mid > 0 else None
    second_half_pace = _median_pace(all_runs_for_pace[mid:]) if mid > 0 else None
    pace_trend = None
    if first_half_pace and second_half_pace:
        diff = second_half_pace - first_half_pace
        pace_trend = "improving" if diff < -5 else "declining" if diff > 5 else "stable"

    return {
        "data": {
            "weeks": weeks_data,
            "summary": {
                "total_sessions": len(activities),
                "total_distance_km": round(total_dist / 1000, 1),
                "total_duration_s": total_dur,
                "total_elevation_m": round(total_elev, 0),
                "longest_run_km": round(longest_run, 1),
                "avg_weekly_km": round((total_dist / 1000) / max(len(weeks_data), 1), 1),
                "pace_trend": pace_trend,
                "first_half_pace_s_per_km": first_half_pace,
                "second_half_pace_s_per_km": second_half_pace,
            },
        },
        "error": None,
    }


# ---------------------------------------------------------------------------
# /api/analytics/vo2max
# ---------------------------------------------------------------------------

@router.get("/vo2max")
async def get_vo2max(athlete: Athlete = Depends(get_current_athlete)):
    """
    VO2max estimate from ACSM formula: current value, trend, fitness age,
    top contributing runs, full history for sparkline.
    """
    db = await get_db()
    athlete_id = str(athlete.id)
    max_hr = athlete.max_hr or 190

    activities = await _fetch_run_activities(db, athlete_id, days=180)
    vo2max_data = compute_vo2max_trend(activities, max_hr=max_hr)

    # Race predictions use best_effort (80th pct) — reflects peak performance, not daily average
    race_predictions = None
    if vo2max_data.get("best_effort"):
        race_predictions = compute_race_predictions(vo2max_data["best_effort"])

    return {
        "data": {
            **vo2max_data,
            "race_predictions": race_predictions,
            "max_hr_used": max_hr,
        },
        "error": None,
    }


# ---------------------------------------------------------------------------
# /api/analytics/race-predictions
# ---------------------------------------------------------------------------

@router.get("/race-predictions")
async def get_race_predictions(athlete: Athlete = Depends(get_current_athlete)):
    """
    Race time predictions for 5K/10K/HM/Marathon using Daniels' VDOT formula,
    plus PR trajectory for common goal times.
    """
    db = await get_db()
    athlete_id = str(athlete.id)
    max_hr = athlete.max_hr or 190

    activities = await _fetch_run_activities(db, athlete_id, days=180)
    vo2max_data = compute_vo2max_trend(activities, max_hr=max_hr)

    if not vo2max_data["current"]:
        return {
            "data": None,
            "error": {"code": "insufficient_data", "message": "Not enough running data to estimate VO2max."},
        }

    # Use best_effort for race predictions (80th pct) — race performance reflects peaks, not daily average
    pred_vo2max = vo2max_data.get("best_effort") or vo2max_data["current"]
    predictions = compute_race_predictions(pred_vo2max)

    # PR trajectories for common goals
    goal_targets = {
        "5K": [("Sub-20", 1200), ("Sub-25", 1500), ("Sub-30", 1800)],
        "10K": [("Sub-40", 2400), ("Sub-50", 3000), ("Sub-60", 3600)],
        "Half Marathon": [("Sub-1:45", 6300), ("Sub-2:00", 7200)],
        "Marathon": [("Sub-3:30", 12600), ("Sub-4:00", 14400)],
    }
    trajectories = {}
    for dist_name, goals in goal_targets.items():
        dist_m = {"5K": 5000, "10K": 10000, "Half Marathon": 21097, "Marathon": 42195}[dist_name]
        trajectories[dist_name] = []
        for label, target_s in goals:
            traj = pr_trajectory(pred_vo2max, target_s, dist_m)
            trajectories[dist_name].append({"label": label, "target_time": format_race_time(target_s), **traj})

    return {
        "data": {
            "vo2max": vo2max_data["current"],
            "best_effort_vo2max": pred_vo2max,
            "vo2max_confidence": vo2max_data["confidence"],
            "predictions": predictions,
            "trajectories": trajectories,
        },
        "error": None,
    }


# ---------------------------------------------------------------------------
# /api/analytics/heart-rate
# ---------------------------------------------------------------------------

def _zone_for_hr(avg_hr: int, max_hr: int) -> int:
    pct = avg_hr / max_hr
    if pct < 0.60: return 1
    if pct < 0.70: return 2
    if pct < 0.80: return 3
    if pct < 0.90: return 4
    return 5


def _estimate_zone_mins(avg_hr: int, duration_s: int, max_hr: int) -> dict:
    """
    Distribute a run's duration across zones based on avg HR.
    Primary zone gets 65%, adjacent zones share the rest.
    This is an approximation — real zone breakdown requires HR stream data.
    """
    z = _zone_for_hr(avg_hr, max_hr)
    total_mins = duration_s / 60
    zones: dict[int, float] = {1: 0.0, 2: 0.0, 3: 0.0, 4: 0.0, 5: 0.0}
    zones[z] = total_mins * 0.65
    if z > 1: zones[z - 1] += total_mins * 0.25
    else:      zones[2]     += total_mins * 0.25
    if z < 5: zones[z + 1]  += total_mins * 0.10
    else:     zones[4]      += total_mins * 0.10
    return zones


@router.get("/heart-rate")
async def get_heart_rate(
    weeks: int = Query(8, ge=1, le=52),
    athlete: Athlete = Depends(get_current_athlete),
):
    """
    HR zone distributions computed from runs only (type == 'Run').
    Uses avg_hr per activity to estimate zone time distribution per week.
    HR trend is also runs-only.
    """
    db = await get_db()
    athlete_id = str(athlete.id)
    days = weeks * 7
    max_hr = athlete.max_hr or 190

    # Fetch run activities only
    activities = await _fetch_run_activities(db, athlete_id, days=days)

    from collections import defaultdict

    # Aggregate zone minutes per week from runs
    weekly_zones: dict = defaultdict(lambda: {1: 0.0, 2: 0.0, 3: 0.0, 4: 0.0, 5: 0.0})
    weekly_hr: dict = defaultdict(list)

    for a in activities:
        avg_hr = a.get("avg_hr") or 0
        dur = a.get("duration_s") or 0
        if avg_hr <= 0 or dur <= 0:
            continue
        d = date.fromisoformat(a["date"])
        week_start = (d - timedelta(days=d.weekday())).isoformat()
        zone_dist = _estimate_zone_mins(avg_hr, dur, max_hr)
        for z, mins in zone_dist.items():
            weekly_zones[week_start][z] += mins
        weekly_hr[week_start].append(avg_hr)

    # Build zone_weeks output
    zone_weeks = []
    for ws in sorted(weekly_zones.keys()):
        zw = weekly_zones[ws]
        total = sum(zw.values())
        hard_mins = zw[4] + zw[5]
        polarization = round(hard_mins / total * 100, 1) if total > 0 else 0
        zone_weeks.append({
            "week_start": ws,
            "z1_mins": round(zw[1], 1),
            "z2_mins": round(zw[2], 1),
            "z3_mins": round(zw[3], 1),
            "z4_mins": round(zw[4], 1),
            "z5_mins": round(zw[5], 1),
            "polarization_score": polarization,
        })

    latest_zones = zone_weeks[-1] if zone_weeks else None

    recent_4w = zone_weeks[-4:] if len(zone_weeks) >= 4 else zone_weeks
    avg_polarization = None
    if recent_4w:
        avg_polarization = round(sum(w["polarization_score"] for w in recent_4w) / len(recent_4w), 1)

    hr_trend = [
        {"week_start": ws, "avg_hr": round(sum(hrs) / len(hrs))}
        for ws, hrs in sorted(weekly_hr.items())
    ]

    # Zone balance flags
    flags = []
    if latest_zones:
        total = sum(latest_zones.get(f"z{i}_mins") or 0 for i in range(1, 6))
        if total > 0:
            hard_pct = ((latest_zones["z4_mins"] + latest_zones["z5_mins"]) / total * 100)
            easy_pct = ((latest_zones["z1_mins"] + latest_zones["z2_mins"]) / total * 100)
            if hard_pct > 50:
                flags.append({"type": "warning", "message": f"{hard_pct:.0f}% of run time in Z4–Z5 this week — too much intensity."})
            if easy_pct < 60:
                flags.append({"type": "info", "message": "Less than 60% easy aerobic run time. Add Z1–Z2 volume to build base."})

    return {
        "data": {
            "zone_weeks": zone_weeks,
            "latest_zones": latest_zones,
            "avg_polarization_4w": avg_polarization,
            "hr_trend": hr_trend,
            "flags": flags,
            "max_hr": max_hr,
            "data_source": "runs_only",
            "zone_thresholds": {
                "z1": "< 60% HRmax",
                "z2": "60–70% HRmax",
                "z3": "70–80% HRmax",
                "z4": "80–90% HRmax",
                "z5": "> 90% HRmax",
            },
        },
        "error": None,
    }


# ---------------------------------------------------------------------------
# /api/analytics/training-load
# ---------------------------------------------------------------------------

@router.get("/training-load")
async def get_training_load(
    days: int = Query(42, ge=14, le=180),
    athlete: Athlete = Depends(get_current_athlete),
):
    """
    ATL/CTL/TSB/ACWR/Monotony/Strain history for charts.
    Includes threshold annotations and current values.
    """
    db = await get_db()
    athlete_id = str(athlete.id)

    features_history = await _fetch_features_history(db, athlete_id, days=days)

    if not features_history:
        return {"data": None, "error": {"code": "no_data", "message": "No training load data yet."}}

    latest = features_history[-1]

    # ACWR annotation bands
    acwr_bands = [
        {"label": "Optimal", "min": 0.8, "max": 1.3, "color": "green"},
        {"label": "Caution", "min": 1.3, "max": 1.5, "color": "orange"},
        {"label": "High Risk", "min": 1.5, "max": 99, "color": "red"},
    ]

    # Flags based on current values
    flags = []
    acwr = latest.get("acwr") or 0
    tsb = latest.get("tsb") or 0
    monotony = latest.get("monotony") or 0

    if acwr > 1.5:
        flags.append({"type": "danger", "field": "acwr", "message": f"ACWR {acwr:.2f} — high injury risk zone. Reduce load immediately."})
    elif acwr > 1.3:
        flags.append({"type": "warning", "field": "acwr", "message": f"ACWR {acwr:.2f} — approaching overreach. Monitor closely."})

    if tsb < -20:
        flags.append({"type": "warning", "field": "tsb", "message": f"TSB {tsb:.0f} — significant fatigue accumulated."})
    elif tsb > 25:
        flags.append({"type": "info", "field": "tsb", "message": f"TSB {tsb:.0f} — very fresh. Good window for a quality session."})

    if monotony and monotony > 2.0:
        flags.append({"type": "warning", "field": "monotony", "message": f"Monotony {monotony:.1f} — training too repetitive. Add variety."})

    return {
        "data": {
            "history": features_history,
            "current": {
                "atl": round(latest.get("atl") or 0, 1),
                "ctl": round(latest.get("ctl") or 0, 1),
                "tsb": round(latest.get("tsb") or 0, 1),
                "acwr": round(latest.get("acwr") or 0, 2),
                "monotony": round(latest.get("monotony") or 0, 2),
                "strain": round(latest.get("strain") or 0, 1),
            },
            "acwr_bands": acwr_bands,
            "flags": flags,
        },
        "error": None,
    }


# ---------------------------------------------------------------------------
# /api/analytics/phase
# ---------------------------------------------------------------------------

@router.get("/phase")
async def get_training_phase(athlete: Athlete = Depends(get_current_athlete)):
    """
    Current training phase (recovery/taper/peak/build/base/transition)
    with reasoning, guidance, and supporting metrics.
    """
    db = await get_db()
    athlete_id = str(athlete.id)

    features_history = await _fetch_features_history(db, athlete_id, days=90)
    phase = classify_training_phase(features_history)

    # Recent phase history (last 8 weeks, sampled weekly)
    phase_history = []
    if len(features_history) >= 7:
        # Sample every 7 days going back
        for i in range(0, min(len(features_history) - 7, 56), 7):
            window = features_history[: len(features_history) - i]
            p = classify_training_phase(window)
            snap_date = features_history[len(features_history) - i - 1]["date"]
            phase_history.append({"date": snap_date, "phase": p["phase"], "emoji": p["emoji"]})
        phase_history.reverse()

    return {
        "data": {
            **phase,
            "history": phase_history,
        },
        "error": None,
    }


# ---------------------------------------------------------------------------
# /api/analytics/goals
# ---------------------------------------------------------------------------

@router.get("/goals")
async def get_goals(
    distance: str = Query("5K", description="5K | 10K | Half Marathon | Marathon"),
    target_time: Optional[str] = Query(None, description="Target time in HH:MM:SS or MM:SS"),
    athlete: Athlete = Depends(get_current_athlete),
):
    """
    PR trajectory for a custom goal. Returns weeks to target, current predicted
    time, and gap analysis.
    """
    db = await get_db()
    athlete_id = str(athlete.id)
    max_hr = athlete.max_hr or 190

    activities = await _fetch_run_activities(db, athlete_id, days=180)
    vo2max_data = compute_vo2max_trend(activities, max_hr=max_hr)

    if not vo2max_data["current"]:
        return {
            "data": None,
            "error": {"code": "insufficient_data", "message": "Not enough running data to estimate VO2max."},
        }

    dist_map = {"5K": 5000, "10K": 10000, "Half Marathon": 21097, "Marathon": 42195}
    dist_m = dist_map.get(distance, 5000)
    current_vo2max = vo2max_data["current"]

    # Current prediction for this distance
    from app.ml.race_predictor import predict_race_time_seconds, format_pace
    current_pred_s = predict_race_time_seconds(dist_m, current_vo2max)

    # Parse target time if provided
    target_s = None
    if target_time:
        try:
            parts = target_time.strip().split(":")
            if len(parts) == 3:
                target_s = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
            elif len(parts) == 2:
                target_s = int(parts[0]) * 60 + int(parts[1])
        except (ValueError, IndexError):
            return {"data": None, "error": {"code": "invalid_time", "message": "Use MM:SS or HH:MM:SS format."}}

    trajectory = None
    if target_s and current_pred_s:
        trajectory = pr_trajectory(current_vo2max, target_s, dist_m)

    # All distances prediction table
    all_predictions = compute_race_predictions(current_vo2max)

    return {
        "data": {
            "distance": distance,
            "current_vo2max": current_vo2max,
            "current_predicted_time": format_race_time(current_pred_s) if current_pred_s else None,
            "current_predicted_seconds": current_pred_s,
            "current_pace": format_pace(dist_m, current_pred_s) if current_pred_s else None,
            "target_time": target_time,
            "target_seconds": target_s,
            "trajectory": trajectory,
            "all_predictions": all_predictions,
        },
        "error": None,
    }
