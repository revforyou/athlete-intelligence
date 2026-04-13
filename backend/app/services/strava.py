from datetime import datetime, timezone

import httpx

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decrypt_token, encrypt_token

STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token"
STRAVA_API_BASE = "https://www.strava.com/api/v3"


async def get_valid_access_token(athlete_id: str) -> str:
    db = await get_db()
    result = await db.table("athletes").select(
        "access_token_enc,refresh_token_enc,token_expires_at"
    ).eq("id", athlete_id).execute()

    if not result.data:
        raise ValueError(f"Athlete {athlete_id} not found")

    row = result.data[0]
    expires_at = row["token_expires_at"]

    # Check if token is expired (with 5-min buffer)
    if expires_at:
        exp_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        buffer_seconds = 300
        if (exp_dt - now).total_seconds() < buffer_seconds:
            # Refresh token
            refresh_token = decrypt_token(row["refresh_token_enc"])
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    STRAVA_TOKEN_URL,
                    data={
                        "client_id": settings.strava_client_id,
                        "client_secret": settings.strava_client_secret,
                        "refresh_token": refresh_token,
                        "grant_type": "refresh_token",
                    },
                )
            if resp.status_code != 200:
                raise ValueError("Failed to refresh Strava token")

            token_data = resp.json()
            new_access_enc = encrypt_token(token_data["access_token"])
            new_refresh_enc = encrypt_token(token_data["refresh_token"])
            new_expires = datetime.fromtimestamp(
                token_data["expires_at"], tz=timezone.utc
            ).isoformat()

            await db.table("athletes").update(
                {
                    "access_token_enc": new_access_enc,
                    "refresh_token_enc": new_refresh_enc,
                    "token_expires_at": new_expires,
                }
            ).eq("id", athlete_id).execute()

            return token_data["access_token"]

    return decrypt_token(row["access_token_enc"])


async def fetch_activities(athlete_id: str, days_back: int = 90) -> list:
    from datetime import timedelta

    access_token = await get_valid_access_token(athlete_id)
    after = int((datetime.now(timezone.utc) - timedelta(days=days_back)).timestamp())

    activities = []
    page = 1
    async with httpx.AsyncClient() as client:
        while True:
            resp = await client.get(
                f"{STRAVA_API_BASE}/athlete/activities",
                headers={"Authorization": f"Bearer {access_token}"},
                params={"after": after, "per_page": 100, "page": page},
            )
            if resp.status_code == 429:
                raise StravaRateLimitError("Rate limit exceeded")
            resp.raise_for_status()
            data = resp.json()
            if not data:
                break
            activities.extend(data)
            if len(data) < 100:
                break
            page += 1

    return activities


async def fetch_activity_streams(
    athlete_id: str, activity_id: int, stream_types: list = None
) -> dict:
    if stream_types is None:
        stream_types = ["heartrate", "time", "watts", "cadence"]

    access_token = await get_valid_access_token(athlete_id)
    keys = ",".join(stream_types)

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{STRAVA_API_BASE}/activities/{activity_id}/streams",
            headers={"Authorization": f"Bearer {access_token}"},
            params={"keys": keys, "key_by_type": "true"},
        )
        if resp.status_code == 429:
            raise StravaRateLimitError("Rate limit exceeded")
        if resp.status_code == 404:
            return {}
        resp.raise_for_status()
        return resp.json()


class StravaRateLimitError(Exception):
    pass
