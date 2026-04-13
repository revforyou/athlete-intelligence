import asyncio
import time
from typing import Optional

import redis.asyncio as aioredis

from app.core.config import settings
from app.core.database import get_db
from app.services.strava import StravaRateLimitError, fetch_activity_streams

# Strava allows 100 requests per 15 min for streams
RATE_LIMIT_BUCKET_KEY = "strava:streams:tokens"
RATE_LIMIT_CAPACITY = 95  # keep a small buffer
RATE_LIMIT_REFILL_RATE = 95 / (15 * 60)  # tokens per second
RATE_LIMIT_LAST_REFILL_KEY = "strava:streams:last_refill"


async def _get_redis():
    return aioredis.from_url(settings.redis_url, decode_responses=True)


async def _acquire_rate_limit_token(redis_client) -> bool:
    now = time.time()
    last_refill = float(await redis_client.get(RATE_LIMIT_LAST_REFILL_KEY) or now)
    elapsed = now - last_refill
    tokens = float(await redis_client.get(RATE_LIMIT_BUCKET_KEY) or RATE_LIMIT_CAPACITY)

    # Refill tokens
    tokens = min(RATE_LIMIT_CAPACITY, tokens + elapsed * RATE_LIMIT_REFILL_RATE)
    await redis_client.set(RATE_LIMIT_LAST_REFILL_KEY, now)

    if tokens >= 1:
        await redis_client.set(RATE_LIMIT_BUCKET_KEY, tokens - 1)
        return True
    return False


async def ingest_activity_streams(
    athlete_id: str,
    activity_id: int,
    strava_activity_id: int,
    max_retries: int = 3,
) -> Optional[dict]:
    redis_client = await _get_redis()

    for attempt in range(max_retries):
        has_token = await _acquire_rate_limit_token(redis_client)
        if not has_token:
            wait_time = 60 * (2 ** attempt)
            await asyncio.sleep(wait_time)
            continue

        try:
            streams = await fetch_activity_streams(athlete_id, strava_activity_id)
            if not streams:
                return None

            hr_data = streams.get("heartrate", {}).get("data", [])
            time_data = streams.get("time", {}).get("data", [])
            watts_data = streams.get("watts", {}).get("data", [])
            cadence_data = streams.get("cadence", {}).get("data", [])

            if not hr_data:
                return None

            db = await get_db()
            await db.table("hr_streams").upsert(
                {
                    "activity_id": str(activity_id),
                    "athlete_id": athlete_id,
                    "timestamps": time_data,
                    "heartrate": hr_data,
                    "watts": watts_data,
                    "cadence": cadence_data,
                }
            ).execute()

            return {
                "heartrate": hr_data,
                "timestamps": time_data,
                "watts": watts_data,
                "cadence": cadence_data,
            }

        except StravaRateLimitError:
            wait_time = 15 * 60  # 15 min
            await asyncio.sleep(wait_time)
        except Exception:
            if attempt == max_retries - 1:
                raise
            await asyncio.sleep(5 * (attempt + 1))

    return None
