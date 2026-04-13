from datetime import date, timedelta

from fastapi import APIRouter, Depends

from app.api.deps import get_current_athlete
from app.core.database import get_db
from app.ml.bayesian import get_calibrated_score
from app.ml.risk_scorer import score_athlete
from app.models.athlete import Athlete
from app.services.llm import generate_recommendation

router = APIRouter(prefix="/api/scores", tags=["scores"])


@router.get("/today")
async def get_today_score(athlete: Athlete = Depends(get_current_athlete)):
    db = await get_db()
    today = date.today().isoformat()

    # Return cached score if available
    cached = (
        await db.table("risk_scores")
        .select("*")
        .eq("athlete_id", str(athlete.id))
        .eq("date", today)
        .execute()
    )
    if cached.data:
        score_row = cached.data[0]
        # Get calibration state
        model_state = await db.table("athlete_model_state").select("*").eq("athlete_id", str(athlete.id)).execute()
        state = model_state.data[0] if model_state.data else {"alpha": 2.0, "beta": 2.0, "n_observations": 0}
        calibration = get_calibrated_score(state, score_row["score"])

        # Get cached recommendation
        rec = await db.table("recommendations").select("*").eq("athlete_id", str(athlete.id)).eq("date", today).execute()
        rec_data = rec.data[0] if rec.data else None

        return {
            "data": {
                "score": calibration["score"],
                "raw_score": score_row["score"],
                "top_factors": score_row["top_factors"],
                "model_version": score_row["model_version"],
                "calibration": calibration,
                "recommendation": rec_data,
            },
            "error": None,
        }

    # Compute fresh
    since = (date.today() - timedelta(days=60)).isoformat()
    features_result = (
        await db.table("daily_features")
        .select("*")
        .eq("athlete_id", str(athlete.id))
        .gte("date", since)
        .order("date", desc=True)
        .limit(1)
        .execute()
    )
    if not features_result.data:
        return {"data": None, "error": {"code": "no_features", "message": "No features computed yet"}}

    features = features_result.data[0]
    zone_result = (
        await db.table("zone_distributions")
        .select("*")
        .eq("athlete_id", str(athlete.id))
        .order("week_start", desc=True)
        .limit(1)
        .execute()
    )
    zone_data = zone_result.data[0] if zone_result.data else {}

    score_data = score_athlete(features)

    model_state = await db.table("athlete_model_state").select("*").eq("athlete_id", str(athlete.id)).execute()
    state = model_state.data[0] if model_state.data else {"alpha": 2.0, "beta": 2.0, "n_observations": 0}
    calibration = get_calibrated_score(state, score_data["score"])

    # Persist score
    await db.table("risk_scores").upsert(
        {
            "athlete_id": str(athlete.id),
            "date": today,
            "score": score_data["score"],
            "top_factors": score_data["top_factors"],
            "model_version": score_data["model_version"],
        }
    ).execute()

    # Generate LLM recommendation
    rec = await generate_recommendation(
        features=features,
        risk_score=calibration["score"],
        top_factors=score_data["top_factors"],
        zone_data=zone_data,
        calibration=calibration,
    )
    await db.table("recommendations").upsert(
        {
            "athlete_id": str(athlete.id),
            "date": today,
            "text": rec["text"],
            "action": rec["action"],
            "score_ref": calibration["score"],
            "tokens_used": rec.get("tokens_used"),
        }
    ).execute()

    return {
        "data": {
            "score": calibration["score"],
            "raw_score": score_data["score"],
            "top_factors": score_data["top_factors"],
            "model_version": score_data["model_version"],
            "calibration": calibration,
            "recommendation": rec,
        },
        "error": None,
    }


@router.get("/history")
async def get_score_history(athlete: Athlete = Depends(get_current_athlete)):
    db = await get_db()
    since = (date.today() - timedelta(days=42)).isoformat()
    result = (
        await db.table("risk_scores")
        .select("date,score,top_factors,model_version")
        .eq("athlete_id", str(athlete.id))
        .gte("date", since)
        .order("date", desc=False)
        .execute()
    )
    return {"data": result.data, "error": None}
