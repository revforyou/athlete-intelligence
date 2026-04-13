from datetime import date, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends

from app.api.deps import get_current_athlete
from app.core.database import get_db
from app.models.athlete import Athlete, AthletePublic
from app.services.tasks import ingest_athlete_activities

router = APIRouter(prefix="/api/athletes", tags=["athletes"])


@router.get("/me")
async def get_me(athlete: Athlete = Depends(get_current_athlete)):
    return {
        "data": AthletePublic(**athlete.model_dump()).model_dump(),
        "error": None,
    }


@router.get("/me/features")
async def get_features(athlete: Athlete = Depends(get_current_athlete)):
    db = await get_db()
    since = (date.today() - timedelta(days=42)).isoformat()
    result = (
        await db.table("daily_features")
        .select("*")
        .eq("athlete_id", str(athlete.id))
        .gte("date", since)
        .order("date", desc=False)
        .execute()
    )
    return {"data": result.data, "error": None}


@router.post("/me/ingest")
async def trigger_ingest(
    background_tasks: BackgroundTasks,
    athlete: Athlete = Depends(get_current_athlete),
):
    background_tasks.add_task(ingest_athlete_activities, str(athlete.id), days_back=90)
    return {"data": {"status": "ingestion_queued"}, "error": None}
