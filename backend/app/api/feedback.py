from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.deps import get_current_athlete
from app.core.database import get_db
from app.ml.bayesian import update_model
from app.models.athlete import Athlete

router = APIRouter(prefix="/api", tags=["feedback"])

VALID_RATINGS = {"too_hard", "about_right", "easy"}


class FeedbackRequest(BaseModel):
    rating: str
    block_end_date: date | None = None
    risk_score_at_time: int | None = None


@router.post("/feedback")
async def submit_feedback(
    body: FeedbackRequest,
    athlete: Athlete = Depends(get_current_athlete),
):
    if body.rating not in VALID_RATINGS:
        raise HTTPException(status_code=400, detail=f"rating must be one of {VALID_RATINGS}")

    db = await get_db()

    # Store feedback event
    await db.table("feedback_events").insert(
        {
            "athlete_id": str(athlete.id),
            "rating": body.rating,
            "block_end_date": body.block_end_date.isoformat() if body.block_end_date else None,
            "risk_score_at_time": body.risk_score_at_time,
        }
    ).execute()

    # Update Bayesian model
    state_result = await db.table("athlete_model_state").select("*").eq("athlete_id", str(athlete.id)).execute()
    if state_result.data:
        state = state_result.data[0]
        new_state = update_model(state, body.rating)
        await db.table("athlete_model_state").update(
            {
                "alpha": new_state["alpha"],
                "beta": new_state["beta"],
                "n_observations": new_state["n_observations"],
            }
        ).eq("athlete_id", str(athlete.id)).execute()

    return {"data": {"status": "feedback_recorded"}, "error": None}
