from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.athlete import Athlete

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/strava/authorize")


async def get_current_athlete(token: str = Depends(oauth2_scheme)) -> Athlete:
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    athlete_id = payload.get("sub")
    if not athlete_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    db = await get_db()
    result = await db.table("athletes").select("*").eq("id", athlete_id).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Athlete not found")

    return Athlete(**result.data[0])
