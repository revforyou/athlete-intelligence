from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class Athlete(BaseModel):
    id: UUID
    strava_id: int
    email: Optional[str] = None
    name: Optional[str] = None
    token_expires_at: Optional[datetime] = None
    max_hr: int = 190
    created_at: datetime


class AthletePublic(BaseModel):
    id: UUID
    strava_id: int
    name: Optional[str] = None
    email: Optional[str] = None
    max_hr: int = 190
    created_at: datetime


class ActivityModel(BaseModel):
    id: UUID
    athlete_id: UUID
    strava_activity_id: int
    type: Optional[str] = None
    distance_m: Optional[float] = None
    duration_s: Optional[int] = None
    elevation_m: Optional[float] = None
    avg_hr: Optional[int] = None
    tss: Optional[float] = None
    date: date
    created_at: datetime


class RiskScore(BaseModel):
    score: int
    top_factors: list
    shap_values: Optional[dict] = None
    model_version: str
    date: date


class Recommendation(BaseModel):
    text: str
    action: str
    score_ref: int
    tokens_used: Optional[int] = None
    date: date


class ZoneDistribution(BaseModel):
    athlete_id: UUID
    week_start: date
    z1_mins: float
    z2_mins: float
    z3_mins: float
    z4_mins: float
    z5_mins: float
    polarization_score: float


class DailyFeatures(BaseModel):
    athlete_id: UUID
    date: date
    atl: float
    ctl: float
    tsb: float
    acwr: float
    monotony: float
    strain: float
    zone_imbalance_score: Optional[float] = None
