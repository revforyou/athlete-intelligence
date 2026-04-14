from fastapi import HTTPException, Request, status

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.athlete import Athlete


async def get_current_athlete(request: Request) -> Athlete:
    # Read JWT from httpOnly cookie — never exposed to JavaScript
    token = request.cookies.get("ai_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    athlete_id = payload.get("sub")
    if not athlete_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    db = await get_db()
    result = await db.table("athletes").select("*").eq("id", athlete_id).execute()
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Athlete not found",
        )

    return Athlete(**result.data[0])
