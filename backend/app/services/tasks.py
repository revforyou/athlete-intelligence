import asyncio
from datetime import date, timedelta

from celery import Celery

from app.core.config import settings

celery_app = Celery("athlete_intelligence", broker=settings.celery_broker_url)
celery_app.conf.task_serializer = "json"
celery_app.conf.result_serializer = "json"
celery_app.conf.accept_content = ["json"]
celery_app.conf.timezone = "UTC"


# Async version — used directly by FastAPI BackgroundTasks
async def ingest_athlete_activities(athlete_id: str, days_back: int = 90):
    try:
        await _ingest_async(athlete_id, days_back)
    except Exception as exc:
        from app.services.strava import StravaRateLimitError
        if isinstance(exc, StravaRateLimitError):
            # Just log and bail — Celery would retry but we're running inline
            import logging
            logging.warning(f"Strava rate limit hit for athlete {athlete_id}, skipping ingestion")
        else:
            raise


# Celery task wrapper — used in production with a worker
@celery_app.task(
    bind=True,
    max_retries=5,
    default_retry_delay=15 * 60,
    name="tasks.ingest_athlete_activities_celery",
)
def ingest_athlete_activities_celery(self, athlete_id: str, days_back: int = 90):
    try:
        asyncio.run(_ingest_async(athlete_id, days_back))
    except Exception as exc:
        from app.services.strava import StravaRateLimitError
        if isinstance(exc, StravaRateLimitError):
            raise self.retry(exc=exc, countdown=15 * 60)
        raise


async def _ingest_async(athlete_id: str, days_back: int):
    import pandas as pd

    from app.core.database import get_db
    from app.ml.drift import detect_drift
    from app.ml.features import compute_features, compute_tss
    from app.ml.zones import compute_weekly_zones, compute_zone_minutes
    from app.services.strava import fetch_activities
    from app.services.streams import ingest_activity_streams

    activities = await fetch_activities(athlete_id, days_back=days_back)
    db = await get_db()

    ath_result = await db.table("athletes").select("max_hr").eq("id", athlete_id).execute()
    max_hr = ath_result.data[0]["max_hr"] if ath_result.data else 190

    tss_by_date: dict[date, float] = {}

    for act in activities:
        act_date = date.fromisoformat(act["start_date_local"][:10])
        duration_s = act.get("moving_time", 0)
        avg_hr = act.get("average_heartrate") or 0
        tss = compute_tss(act.get("type", ""), duration_s, int(avg_hr), max_hr)

        upsert_data = {
            "athlete_id": athlete_id,
            "strava_activity_id": act["id"],
            "type": act.get("type"),
            "distance_m": act.get("distance"),
            "duration_s": duration_s,
            "elevation_m": act.get("total_elevation_gain"),
            "avg_hr": int(avg_hr) if avg_hr else None,
            "tss": tss,
            "date": act_date.isoformat(),
            "raw_data": act,
        }

        result = await db.table("activities").upsert(upsert_data).execute()
        activity_uuid = result.data[0]["id"] if result.data else None

        tss_by_date[act_date] = tss_by_date.get(act_date, 0) + tss

        cutoff = date.today() - timedelta(days=30)
        if activity_uuid and act_date >= cutoff and avg_hr > 0:
            await ingest_activity_streams(athlete_id, activity_uuid, act["id"])

    if tss_by_date:
        idx = pd.date_range(
            start=min(tss_by_date.keys()), end=date.today(), freq="D"
        )
        series = pd.Series(tss_by_date).reindex(idx, fill_value=0.0)
        features_df = compute_features(series)

        for feat_date, row in features_df.iterrows():
            await db.table("daily_features").upsert(
                {
                    "athlete_id": athlete_id,
                    "date": feat_date.strftime("%Y-%m-%d"),
                    "atl": float(row["atl"]),
                    "ctl": float(row["ctl"]),
                    "tsb": float(row["tsb"]),
                    "acwr": float(row["acwr"]),
                    "monotony": float(row["monotony"]),
                    "strain": float(row["strain"]),
                }
            ).execute()

    streams_result = await db.table("hr_streams").select("*,activities(date)").eq("athlete_id", athlete_id).execute()
    week_zone_data: dict[date, list] = {}

    for stream in (streams_result.data or []):
        hr = stream.get("heartrate") or []
        ts = stream.get("timestamps") or []
        act_date_str = (stream.get("activities") or {}).get("date")
        if not hr or not act_date_str:
            continue
        act_date = date.fromisoformat(act_date_str)
        week_start = act_date - timedelta(days=act_date.weekday())
        zone_mins = compute_zone_minutes(hr, ts, max_hr)
        if week_start not in week_zone_data:
            week_zone_data[week_start] = []
        week_zone_data[week_start].append(zone_mins)

    for week_start, zone_list in week_zone_data.items():
        weekly = compute_weekly_zones(zone_list)
        await db.table("zone_distributions").upsert(
            {
                "athlete_id": athlete_id,
                "week_start": week_start.isoformat(),
                **weekly,
            }
        ).execute()

    features_result = await db.table("daily_features").select("acwr,date").eq("athlete_id", athlete_id).order("date", desc=False).execute()
    if features_result.data and len(features_result.data) >= 15:
        acwr_values = [r["acwr"] for r in features_result.data if r["acwr"] is not None]
        baseline = acwr_values[:-5]
        recent = acwr_values[-5:]
        drift = detect_drift(baseline, recent, "acwr")
        if drift["drift_detected"]:
            await db.table("drift_events").insert(
                {
                    "athlete_id": athlete_id,
                    "psi_score": drift["psi_score"],
                    "kl_divergence": drift["kl_divergence"],
                    "feature_name": drift["feature_name"],
                }
            ).execute()
