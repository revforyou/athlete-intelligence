from fastapi import APIRouter, Depends

from app.api.deps import get_current_athlete
from app.core.database import get_db
from app.models.athlete import Athlete

router = APIRouter(prefix="/api/activities", tags=["activities"])


@router.get("")
async def get_activities(athlete: Athlete = Depends(get_current_athlete)):
    db = await get_db()
    result = (
        await db.table("activities")
        .select("id,type,distance_m,duration_s,avg_hr,tss,date")
        .eq("athlete_id", str(athlete.id))
        .order("date", desc=True)
        .limit(5)
        .execute()
    )
    return {"data": result.data, "error": None}
