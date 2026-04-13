# CLAUDE.md — Athlete Intelligence Platform
> Read this entire file before writing any code. This is the single source of truth.

---

## Project Overview

Full-stack athlete load monitoring platform. Users connect Strava via OAuth2. The backend
computes injury risk metrics (ATL/CTL/ACWR/TSB), ingests HR time-series streams to compute
training zone distributions, detects training drift, runs a per-athlete Bayesian calibration
model, and serves a plain-English recommendation powered by Claude Haiku.

**Stack:** Next.js 14 + TypeScript + Tailwind (Vercel) · FastAPI Python 3.11 (Railway) ·
Supabase Postgres · Redis Upstash · Celery

---

## Repository Structure

```
athlete-intelligence/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth.py           # Strava OAuth endpoints
│   │   │   ├── athletes.py       # Athlete profile endpoints
│   │   │   ├── scores.py         # Risk score endpoints
│   │   │   └── webhooks.py       # Strava webhook receiver
│   │   ├── core/
│   │   │   ├── config.py         # Pydantic Settings — all env vars live here
│   │   │   ├── database.py       # Supabase async client
│   │   │   ├── security.py       # AES token encryption, JWT helpers
│   │   │   └── logging.py        # Structured logging config
│   │   ├── ml/
│   │   │   ├── features.py       # ATL/CTL/TSB/ACWR/monotony/strain
│   │   │   ├── zones.py          # HR stream → Z1–Z5 zone breakdown
│   │   │   ├── risk_scorer.py    # Logistic regression + SHAP
│   │   │   ├── bayesian.py       # Beta-Binomial per-athlete calibration
│   │   │   ├── drift.py          # KL divergence, PSI
│   │   │   └── models/           # Serialized .joblib files (gitignored)
│   │   ├── services/
│   │   │   ├── strava.py         # Strava API client (rate-limit aware)
│   │   │   ├── streams.py        # HR/power stream ingestion pipeline
│   │   │   ├── llm.py            # Anthropic SDK + Redis caching
│   │   │   └── tasks.py          # Celery task definitions
│   │   └── models/               # Pydantic + SQLAlchemy models
│   ├── tests/
│   │   ├── test_features.py
│   │   ├── test_zones.py
│   │   ├── test_bayesian.py
│   │   └── test_risk_scorer.py
│   ├── alembic/
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── page.tsx              # Landing + Strava connect
│   │   └── dashboard/page.tsx    # Main dashboard
│   ├── components/
│   │   ├── RiskDial.tsx
│   │   ├── ZoneChart.tsx
│   │   ├── LoadChart.tsx
│   │   ├── DriftAlert.tsx
│   │   ├── FeedbackWidget.tsx
│   │   ├── CalibrationBadge.tsx
│   │   └── ActivityFeed.tsx
│   └── lib/
│       ├── api.ts                # Typed API client — no raw fetch calls elsewhere
│       └── supabase.ts
├── .github/workflows/
│   ├── deploy-backend.yml
│   └── deploy-frontend.yml
├── .gitignore                    # Committed FIRST before any other file
├── CLAUDE.md                     # This file
└── README.md
```

---

## Security — Non-Negotiable Rules

### .gitignore — commit this first, before anything else
```
.env
.env.local
.env.*.local
*.env
backend/app/ml/models/*.joblib
backend/app/ml/models/*.pkl
__pycache__/
*.pyc
.venv/
node_modules/
.next/
.vscode/
.idea/
```

### All config via Pydantic Settings

```python
# app/core/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    strava_client_id: str
    strava_client_secret: str
    strava_redirect_uri: str
    strava_verify_token: str
    supabase_url: str
    supabase_service_key: str
    anthropic_api_key: str
    redis_url: str
    celery_broker_url: str
    sentry_dsn: str
    secret_key: str           # AES encryption + JWT signing
    frontend_url: str
    environment: str = "development"

    class Config:
        env_file = ".env"

settings = Settings()
```

Nothing hardcoded anywhere. All secrets from `settings.*`.

### AES-256 Token Encryption

```python
# app/core/security.py
from cryptography.fernet import Fernet
import base64, hashlib
from app.core.config import settings

def get_fernet():
    key = hashlib.sha256(settings.secret_key.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))

def encrypt_token(token: str) -> str:
    return get_fernet().encrypt(token.encode()).decode()

def decrypt_token(encrypted: str) -> str:
    return get_fernet().decrypt(encrypted.encode()).decode()
```

Every Strava `access_token` and `refresh_token` must pass through `encrypt_token()`
before any DB write. Decrypt only inside `services/strava.py` immediately before an
API call. Never log or return raw tokens.

### FastAPI Auth Dependency

```python
async def get_current_athlete(token: str = Depends(oauth2_scheme)) -> Athlete:
    # Validate JWT, return athlete or raise 401
    ...
```

Apply to every `/api/*` route. `/auth/*` and `/health` are public.

### CORS

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],   # Never ["*"]
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)
```

### Supabase Row-Level Security

Enable on every table:
```sql
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own data only" ON activities
  USING (athlete_id = auth.uid());
```

Repeat for: `hr_streams`, `daily_features`, `zone_distributions`, `risk_scores`,
`athlete_model_state`, `feedback_events`, `recommendations`, `drift_events`.

### Rate Limiting (slowapi)

- General endpoints: 60 req/min per IP
- `/api/scores/today`: 10 req/min per athlete (cost control)
- Strava webhook: 100 req/min

### Strava Webhook Verification

Verify `hub.verify_token` on subscription. Validate `X-Hub-Signature` (HMAC-SHA256)
on every incoming event.

---

## Database Schema

```sql
CREATE TABLE athletes (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strava_id         BIGINT UNIQUE NOT NULL,
    email             TEXT,
    name              TEXT,
    access_token_enc  TEXT NOT NULL,
    refresh_token_enc TEXT NOT NULL,
    token_expires_at  TIMESTAMPTZ,
    max_hr            INT DEFAULT 190,
    created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE activities (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    athlete_id          UUID REFERENCES athletes(id) ON DELETE CASCADE,
    strava_activity_id  BIGINT UNIQUE NOT NULL,
    type                TEXT,
    distance_m          FLOAT,
    duration_s          INT,
    elevation_m         FLOAT,
    avg_hr              INT,
    tss                 FLOAT,
    date                DATE NOT NULL,
    raw_data            JSONB,
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE hr_streams (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id  UUID REFERENCES activities(id) ON DELETE CASCADE,
    athlete_id   UUID REFERENCES athletes(id) ON DELETE CASCADE,
    timestamps   INT[],
    heartrate    INT[],
    watts        INT[],
    cadence      INT[],
    recorded_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE daily_features (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    athlete_id           UUID REFERENCES athletes(id) ON DELETE CASCADE,
    date                 DATE NOT NULL,
    atl                  FLOAT,
    ctl                  FLOAT,
    tsb                  FLOAT,
    acwr                 FLOAT,
    monotony             FLOAT,
    strain               FLOAT,
    zone_imbalance_score FLOAT,
    computed_at          TIMESTAMPTZ DEFAULT now(),
    UNIQUE(athlete_id, date)
);

CREATE TABLE zone_distributions (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    athlete_id         UUID REFERENCES athletes(id) ON DELETE CASCADE,
    week_start         DATE NOT NULL,
    z1_mins            FLOAT,
    z2_mins            FLOAT,
    z3_mins            FLOAT,
    z4_mins            FLOAT,
    z5_mins            FLOAT,
    polarization_score FLOAT,
    computed_at        TIMESTAMPTZ DEFAULT now(),
    UNIQUE(athlete_id, week_start)
);

CREATE TABLE risk_scores (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    athlete_id    UUID REFERENCES athletes(id) ON DELETE CASCADE,
    date          DATE NOT NULL,
    score         INT,
    top_factors   JSONB,
    shap_values   JSONB,
    model_version TEXT,
    created_at    TIMESTAMPTZ DEFAULT now(),
    UNIQUE(athlete_id, date)
);

CREATE TABLE athlete_model_state (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    athlete_id     UUID REFERENCES athletes(id) ON DELETE CASCADE UNIQUE,
    alpha          FLOAT NOT NULL DEFAULT 2.0,
    beta           FLOAT NOT NULL DEFAULT 2.0,
    n_observations INT NOT NULL DEFAULT 0,
    last_updated   TIMESTAMPTZ DEFAULT now(),
    model_version  TEXT DEFAULT 'v1'
);

CREATE TABLE feedback_events (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    athlete_id         UUID REFERENCES athletes(id) ON DELETE CASCADE,
    block_end_date     DATE,
    rating             TEXT,
    risk_score_at_time INT,
    created_at         TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE recommendations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    athlete_id  UUID REFERENCES athletes(id) ON DELETE CASCADE,
    date        DATE NOT NULL,
    text        TEXT NOT NULL,
    action      TEXT,
    score_ref   INT,
    tokens_used INT,
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(athlete_id, date)
);

CREATE TABLE drift_events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    athlete_id    UUID REFERENCES athletes(id) ON DELETE CASCADE,
    detected_at   TIMESTAMPTZ DEFAULT now(),
    psi_score     FLOAT,
    kl_divergence FLOAT,
    feature_name  TEXT,
    alert_sent    BOOLEAN DEFAULT false
);

CREATE INDEX idx_activities_athlete_date ON activities(athlete_id, date DESC);
CREATE INDEX idx_features_athlete_date   ON daily_features(athlete_id, date DESC);
CREATE INDEX idx_scores_athlete_date     ON risk_scores(athlete_id, date DESC);
CREATE INDEX idx_streams_athlete         ON hr_streams(athlete_id);
```

---

## API Endpoints

```
GET  /health
GET  /auth/strava/authorize
GET  /auth/strava/callback
POST /auth/strava/webhook

GET  /api/athletes/me
GET  /api/athletes/me/features
POST /api/athletes/me/ingest

GET  /api/scores/today
GET  /api/scores/history

GET  /api/zones/weekly
POST /api/feedback

GET  /api/activities
```

All responses: `{ "data": { ... }, "error": null }`
Errors: `{ "data": null, "error": { "code": "...", "message": "..." } }`

---

## ML Implementation

### features.py

```python
import pandas as pd
import numpy as np

def compute_tss(activity_type: str, duration_s: int, avg_hr: int,
                athlete_max_hr: int = 190) -> float:
    hr_ratio = avg_hr / athlete_max_hr
    if activity_type == "Run":
        return (duration_s / 3600) * hr_ratio * 100
    elif activity_type == "Ride":
        return (duration_s / 3600) * hr_ratio * 90
    return (duration_s / 3600) * 60

def compute_ewa(series: pd.Series, span_days: int) -> pd.Series:
    alpha = 2 / (span_days + 1)
    return series.ewm(alpha=alpha, adjust=False).mean()

def compute_features(daily_tss: pd.Series) -> pd.DataFrame:
    df = daily_tss.rename("tss").to_frame()
    df["atl"] = compute_ewa(df["tss"], span_days=7)
    df["ctl"] = compute_ewa(df["tss"], span_days=42)
    df["tsb"] = df["ctl"] - df["atl"]
    df["acwr"] = df["atl"] / df["ctl"].replace(0, np.nan)
    rolling = df["tss"].rolling(7, min_periods=3)
    df["monotony"] = rolling.mean() / rolling.std().replace(0, np.nan)
    df["strain"] = rolling.sum() * df["monotony"]
    return df.dropna()
```

### zones.py

Z1–Z5 thresholds as % of max HR: Z1 <60%, Z2 60–70%, Z3 70–80%, Z4 80–90%, Z5 >90%.
Polarization score = (Z4_mins + Z5_mins) / total_mins * 100.
Alert when polarization > 50% or shifts > 15 points from 4-week rolling baseline.

### risk_scorer.py

```python
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
import joblib, shap

FEATURE_COLS = ["acwr", "monotony", "strain", "days_since_rest",
                "volume_delta_pct", "zone_imbalance_score"]
MODEL_PATH = "app/ml/models/risk_model_v1.joblib"

def train_model(X, y):
    pipe = Pipeline([("scaler", StandardScaler()),
                     ("clf", LogisticRegression(C=1.0, max_iter=1000))])
    pipe.fit(X, y)
    joblib.dump(pipe, MODEL_PATH)

def score_athlete(features: dict) -> dict:
    model = joblib.load(MODEL_PATH)
    X = [[features[col] for col in FEATURE_COLS]]
    score = int(model.predict_proba(X)[0][1] * 100)
    explainer = shap.LinearExplainer(model.named_steps["clf"], shap.sample(X, 1))
    shap_vals = explainer.shap_values(X)[0]
    factors = [{"name": col, "value": round(features[col], 3),
                "shap": round(float(shap_vals[i]), 4)}
               for i, col in enumerate(FEATURE_COLS)]
    top_factors = sorted(factors, key=lambda x: abs(x["shap"]), reverse=True)[:3]
    return {"score": score, "top_factors": top_factors, "model_version": "v1"}
```

### bayesian.py

```python
RATING_TO_UPDATE = {
    "too_hard":    {"alpha": 1, "beta": 0},
    "about_right": {"alpha": 0, "beta": 0},
    "easy":        {"alpha": 0, "beta": 1},
}

def initialize_prior() -> dict:
    return {"alpha": 2.0, "beta": 2.0, "n_observations": 0}

def update_model(state: dict, rating: str) -> dict:
    u = RATING_TO_UPDATE[rating]
    return {"alpha": state["alpha"] + u["alpha"],
            "beta":  state["beta"]  + u["beta"],
            "n_observations": state["n_observations"] + 1}

def get_calibrated_score(state: dict, raw_score: int) -> dict:
    n = state["n_observations"]
    if n < 4:
        return {"score": raw_score, "confidence": "low",
                "message": f"Personalizing — {n} of 8 sessions logged"}
    tendency = state["alpha"] / (state["alpha"] + state["beta"])
    adjustment = (tendency - 0.5) * 20
    calibrated = int(min(100, max(0, raw_score + adjustment)))
    confidence = "medium" if n < 8 else "high"
    message = (f"Personalizing — {n} of 8 sessions logged"
               if n < 8 else "Calibrated to your data")
    return {"score": calibrated, "confidence": confidence, "message": message}
```

### llm.py

```python
import anthropic
from app.core.config import settings

SYSTEM_PROMPT = """You are a sports science coach analyzing an athlete's training load.
Give concise, evidence-based daily recommendations. Be direct and specific.
Always explain the primary reason. Mention zone balance if it's a contributing factor.
Respond in exactly 2-3 sentences. End with exactly one of: [TRAIN] [EASY DAY] [REST]."""

async def generate_recommendation(features: dict, risk_score: int,
                                   top_factors: list, zone_data: dict,
                                   calibration: dict) -> dict:
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    user_msg = f"""Athlete data for today:
- Risk score: {risk_score}/100 ({calibration['confidence']} confidence)
- ATL: {features['atl']:.1f}, CTL: {features['ctl']:.1f}, TSB: {features['tsb']:.1f}
- ACWR: {features['acwr']:.2f}
- This week: {zone_data.get('z4_pct', 0):.0f}% time in Z4-Z5
- Top risk factors: {', '.join([f['name'] for f in top_factors])}
- Calibration: {calibration['message']}
What should this athlete do today?"""

    msg = await client.messages.create(
        model="claude-haiku-4-5", max_tokens=200, system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}])
    text = msg.content[0].text
    action = "train"
    if "[EASY DAY]" in text: action = "easy"
    elif "[REST]" in text: action = "rest"
    return {"text": text.replace("[TRAIN]","").replace("[EASY DAY]","")
                        .replace("[REST]","").strip(),
            "action": action,
            "tokens_used": msg.usage.input_tokens + msg.usage.output_tokens}
```

Cache key: `rec:{athlete_id}:{date}:{score}` · TTL 24h · skip if score unchanged.

---

## Frontend Design

**Fonts:** DM Sans (body) + DM Mono (numbers) via Google Fonts

**Colors:**
```
Danger  (76–100): #E8593C
High    (56–75):  #EF9F27
Medium  (31–55):  #378ADD
Low     (0–30):   #1D9E75
Page bg:          #F5F4F1
Card bg:          #FFFFFF
Border:           0.5px rgba(0,0,0,0.08)
```

**Components:**
- `RiskDial` — SVG circle gauge, color-coded ring, large centered score, delta badge
- `ZoneChart` — Recharts stacked bar weekly, reference line at 20% hard threshold
- `LoadChart` — ATL (coral) + CTL (blue) lines over 6 weeks, shaded TSB area
- `DriftAlert` — full-width banner, only renders when psi_score > 0.2
- `FeedbackWidget` — appears after 7+ consecutive training days, 3-button rating
- `CalibrationBadge` — gray/blue/teal pill showing personalization progress
- `ActivityFeed` — last 5 activities, type + distance + color-coded TSS

---

## Python Dependencies

```
fastapi>=0.111        uvicorn[standard]>=0.29   pydantic>=2.0
pydantic-settings>=2.0  supabase>=2.0           httpx>=0.27
celery>=5.3           redis>=5.0                anthropic>=0.28
scikit-learn>=1.4     pandas>=2.2               numpy>=1.26
joblib>=1.4           shap>=0.45                cryptography>=42.0
python-jose[cryptography]>=3.3  slowapi>=0.1.9
sentry-sdk[fastapi]>=2.0        pytest>=8.0     pytest-asyncio>=0.23
```

---

## Coding Conventions

- Never hardcode secrets — always `settings.*`
- Never raw `fetch()` in frontend — always `lib/api.ts`
- Every Strava token DB write must call `encrypt_token()` first
- All `/api/*` routes require JWT auth dependency
- Celery tasks handle `StravaRateLimitError` with 15-min retry backoff
- Unit tests for every ML formula
- API responses always use `{"data": ..., "error": ...}` envelope
- Frontend color coding always follows the 4-tier risk scale above

---

*Last updated: April 2026*
