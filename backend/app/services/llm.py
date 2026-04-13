import json
from datetime import date

import redis.asyncio as aioredis

from groq import AsyncGroq

from app.core.config import settings

SYSTEM_PROMPT = """You are a sports science coach analyzing an athlete's training load.
Give concise, evidence-based daily recommendations. Be direct and specific.
Always explain the primary reason. Mention zone balance if it's a contributing factor.
Respond in exactly 2-3 sentences. End with exactly one of: [TRAIN] [EASY DAY] [REST]."""

CACHE_TTL = 60 * 60 * 24  # 24 hours


async def _get_redis():
    return aioredis.from_url(settings.redis_url, decode_responses=True)


async def generate_recommendation(
    features: dict,
    risk_score: int,
    top_factors: list,
    zone_data: dict,
    calibration: dict,
) -> dict:
    redis_client = await _get_redis()
    today = date.today().isoformat()
    athlete_id = features.get("athlete_id", "unknown")
    cache_key = f"rec:{athlete_id}:{today}:{risk_score}"

    cached = await redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    client = AsyncGroq(api_key=settings.groq_api_key)

    total_zone_mins = sum(
        zone_data.get(k, 0) for k in ["z1_mins", "z2_mins", "z3_mins", "z4_mins", "z5_mins"]
    )
    z4z5_pct = 0.0
    if total_zone_mins > 0:
        z4z5_pct = (zone_data.get("z4_mins", 0) + zone_data.get("z5_mins", 0)) / total_zone_mins * 100

    user_msg = f"""Athlete data for today:
- Risk score: {risk_score}/100 ({calibration['confidence']} confidence)
- ATL: {features.get('atl', 0):.1f}, CTL: {features.get('ctl', 0):.1f}, TSB: {features.get('tsb', 0):.1f}
- ACWR: {features.get('acwr', 0):.2f}
- This week: {z4z5_pct:.0f}% time in Z4-Z5
- Top risk factors: {', '.join([f['name'] for f in top_factors])}
- Calibration: {calibration['message']}
What should this athlete do today?"""

    completion = await client.chat.completions.create(
        model="llama-3.1-8b-instant",
        max_tokens=200,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
    )

    text = completion.choices[0].message.content
    action = "train"
    if "[EASY DAY]" in text:
        action = "easy"
    elif "[REST]" in text:
        action = "rest"

    result = {
        "text": text.replace("[TRAIN]", "").replace("[EASY DAY]", "").replace("[REST]", "").strip(),
        "action": action,
        "tokens_used": completion.usage.prompt_tokens + completion.usage.completion_tokens,
    }

    await redis_client.setex(cache_key, CACHE_TTL, json.dumps(result))
    return result
