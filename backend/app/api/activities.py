from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_athlete
from app.core.database import get_db
from app.models.athlete import Athlete

router = APIRouter(prefix="/api/activities", tags=["activities"])


@router.get("")
async def get_activities(
    sport: Optional[str] = Query(None),
    limit: int = Query(10),
    athlete: Athlete = Depends(get_current_athlete),
):
    db = await get_db()
    query = (
        db.table("activities")
        .select("id,type,distance_m,duration_s,avg_hr,tss,date")
        .eq("athlete_id", str(athlete.id))
        .order("date", desc=True)
    )
    if sport and sport != "All":
        query = query.eq("type", sport)
    result = await query.limit(limit).execute()
    return {"data": result.data, "error": None}


@router.get("/types")
async def get_activity_types(athlete: Athlete = Depends(get_current_athlete)):
    db = await get_db()
    result = (
        await db.table("activities")
        .select("type")
        .eq("athlete_id", str(athlete.id))
        .execute()
    )
    types = sorted(set(a["type"] for a in result.data if a["type"]))
    return {"data": types, "error": None}


@router.get("/stats")
async def get_activity_stats(
    sport: Optional[str] = Query(None),
    period: str = Query("weekly"),  # "weekly" | "monthly"
    athlete: Athlete = Depends(get_current_athlete),
):
    db = await get_db()

    days_back = 7 if period == "weekly" else 30
    since = (date.today() - timedelta(days=days_back)).isoformat()

    query = (
        db.table("activities")
        .select("id,type,distance_m,duration_s,avg_hr,tss,date")
        .eq("athlete_id", str(athlete.id))
        .gte("date", since)
        .order("date", desc=False)
    )
    if sport and sport != "All":
        query = query.eq("type", sport)

    result = await query.execute()
    activities = result.data

    # Aggregate stats
    total_sessions = len(activities)
    total_distance_m = sum(a.get("distance_m") or 0 for a in activities)
    total_duration_s = sum(a.get("duration_s") or 0 for a in activities)
    total_tss = sum(a.get("tss") or 0 for a in activities)
    hr_values = [a["avg_hr"] for a in activities if a.get("avg_hr")]
    avg_hr = round(sum(hr_values) / len(hr_values)) if hr_values else None

    # Per-sport breakdown
    by_sport: dict = {}
    for a in activities:
        t = a.get("type") or "Other"
        if t not in by_sport:
            by_sport[t] = {"sessions": 0, "distance_m": 0, "duration_s": 0, "tss": 0}
        by_sport[t]["sessions"] += 1
        by_sport[t]["distance_m"] += a.get("distance_m") or 0
        by_sport[t]["duration_s"] += a.get("duration_s") or 0
        by_sport[t]["tss"] += a.get("tss") or 0

    # Daily TSS trend for sparkline
    daily_tss: dict[str, float] = {}
    for a in activities:
        d = a["date"]
        daily_tss[d] = daily_tss.get(d, 0) + (a.get("tss") or 0)

    # Avg pace for runs (min/km)
    run_activities = [a for a in activities if a.get("type") == "Run" and (a.get("distance_m") or 0) > 0]
    avg_pace_s_per_km = None
    if run_activities:
        total_run_dist = sum(a["distance_m"] for a in run_activities)
        total_run_time = sum(a["duration_s"] for a in run_activities)
        if total_run_dist > 0:
            avg_pace_s_per_km = round(total_run_time / (total_run_dist / 1000))

    return {
        "data": {
            "period": period,
            "sport": sport or "All",
            "total_sessions": total_sessions,
            "total_distance_km": round(total_distance_m / 1000, 1),
            "total_duration_s": total_duration_s,
            "total_tss": round(total_tss, 1),
            "avg_hr": avg_hr,
            "avg_pace_s_per_km": avg_pace_s_per_km,
            "by_sport": by_sport,
            "daily_tss": daily_tss,
        },
        "error": None,
    }
