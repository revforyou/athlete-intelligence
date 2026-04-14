import hashlib
import hmac
import time
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse

from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token, encrypt_token
from app.services.tasks import ingest_athlete_activities

router = APIRouter(prefix="/auth/strava", tags=["auth"])

STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize"
STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token"


@router.get("/authorize")
async def strava_authorize():
    params = {
        "client_id": settings.strava_client_id,
        "redirect_uri": settings.strava_redirect_uri,
        "response_type": "code",
        "scope": "read,activity:read_all",
        "approval_prompt": "auto",
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return RedirectResponse(url=f"{STRAVA_AUTH_URL}?{query}")


@router.get("/callback")
async def strava_callback(
    code: str = Query(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            STRAVA_TOKEN_URL,
            data={
                "client_id": settings.strava_client_id,
                "client_secret": settings.strava_client_secret,
                "code": code,
                "grant_type": "authorization_code",
            },
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to exchange Strava code")

    token_data = resp.json()
    athlete_info = token_data.get("athlete", {})

    access_token_enc = encrypt_token(token_data["access_token"])
    refresh_token_enc = encrypt_token(token_data["refresh_token"])
    expires_at = datetime.fromtimestamp(token_data["expires_at"], tz=timezone.utc).isoformat()

    db = await get_db()
    existing = await db.table("athletes").select("id").eq("strava_id", athlete_info["id"]).execute()

    if existing.data:
        athlete_id = existing.data[0]["id"]
        await db.table("athletes").update(
            {
                "access_token_enc": access_token_enc,
                "refresh_token_enc": refresh_token_enc,
                "token_expires_at": expires_at,
                "name": athlete_info.get("firstname", "") + " " + athlete_info.get("lastname", ""),
                "email": athlete_info.get("email"),
            }
        ).eq("id", athlete_id).execute()
    else:
        result = await db.table("athletes").insert(
            {
                "strava_id": athlete_info["id"],
                "email": athlete_info.get("email"),
                "name": athlete_info.get("firstname", "") + " " + athlete_info.get("lastname", ""),
                "access_token_enc": access_token_enc,
                "refresh_token_enc": refresh_token_enc,
                "token_expires_at": expires_at,
                "max_hr": 190,
            }
        ).execute()
        athlete_id = result.data[0]["id"]
        # Initialize Bayesian model state
        await db.table("athlete_model_state").insert(
            {"athlete_id": athlete_id, "alpha": 2.0, "beta": 2.0, "n_observations": 0}
        ).execute()

    background_tasks.add_task(ingest_athlete_activities, athlete_id, days_back=90)

    jwt_token = create_access_token({"sub": str(athlete_id)})
    response = RedirectResponse(url=f"{settings.frontend_url}/dashboard")
    response.set_cookie(
        key="ai_token",
        value=jwt_token,
        httponly=True,
        secure=settings.environment == "production",
        samesite="lax",
        max_age=60 * 60 * 24 * 7,
        path="/",
    )
    return response


@router.get("/webhook")
async def strava_webhook_verify(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
):
    if hub_mode == "subscribe" and hub_verify_token == settings.strava_verify_token:
        return {"hub.challenge": hub_challenge}
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/webhook")
async def strava_webhook_receive(request: Request, background_tasks: BackgroundTasks):
    body = await request.body()
    sig = request.headers.get("X-Hub-Signature", "")
    expected = "sha256=" + hmac.new(
        settings.strava_verify_token.encode(), body, hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(sig, expected):
        raise HTTPException(status_code=403, detail="Invalid signature")

    payload = await request.json()
    object_type = payload.get("object_type")
    aspect_type = payload.get("aspect_type")
    owner_id = payload.get("owner_id")

    if object_type == "activity" and aspect_type == "create":
        db = await get_db()
        result = await db.table("athletes").select("id").eq("strava_id", owner_id).execute()
        if result.data:
            athlete_id = result.data[0]["id"]
            background_tasks.add_task(ingest_athlete_activities, athlete_id, days_back=1)

    return {"status": "ok"}
