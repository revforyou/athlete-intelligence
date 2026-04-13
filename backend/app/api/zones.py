from datetime import date, timedelta

from fastapi import APIRouter, Depends

from app.api.deps import get_current_athlete
from app.core.database import get_db
from app.models.athlete import Athlete

router = APIRouter(prefix="/api/zones", tags=["zones"])


@router.get("/weekly")
async def get_weekly_zones(athlete: Athlete = Depends(get_current_athlete)):
    db = await get_db()
    since = (date.today() - timedelta(weeks=8)).isoformat()
    result = (
        await db.table("zone_distributions")
        .select("*")
        .eq("athlete_id", str(athlete.id))
        .gte("week_start", since)
        .order("week_start", desc=False)
        .execute()
    )
    return {"data": result.data, "error": None}
