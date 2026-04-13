# Athlete Intelligence Platform

> *Strava tells you what you did. This tells you if you should do it again.*

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Python](https://img.shields.io/badge/python-3.11-blue)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![License](https://img.shields.io/badge/license-MIT-green)

**Live Demo:** [athlete-intel.vercel.app](#) · **API:** [api.athlete-intel.railway.app](#) · **Built by:** [Venkata Revanth Jyothula](#)

---

## The Problem

Recreational athletes — runners, cyclists, triathletes — get injured not because they train hard, but because they train *inconsistently*. They ramp up too fast after a rest week, ignore accumulated fatigue, or push through warning signs their body is already sending.

Strava records every activity. It never tells you what any of it *means* for tomorrow.

Existing intelligence tools (Whoop, Garmin Connect IQ) are locked behind expensive hardware. The data is already in Strava. The intelligence isn't.

---

## What This Does

Connect your Strava account. Every day you get:

- A **risk score (0–100)** based on your training load patterns
- A **plain-English recommendation** — train, back off, or rest — and *why*
- A **zone breakdown** showing whether your effort distribution is balanced or overloaded
- A **drift alert** when your training pattern shifts significantly from your baseline
- A **personalized model** that calibrates to your body over time, not just population averages

---

## Demo Flow

1. User connects Strava via OAuth2
2. Pipeline ingests last 90 days of activities + HR time-series streams
3. Feature engineering computes load metrics and zone distributions in real time
4. Risk scorer returns a score (0–100) with top contributing factors
5. Bayesian calibration adjusts thresholds to this specific athlete's history
6. LLM generates a plain-English recommendation explaining the *why*
7. Dashboard shows score, zone chart, load history, and drift alerts

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | Next.js 14 (App Router) | SSR, Vercel deploy, great DX |
| Backend API | FastAPI (Python 3.11) | Async, fast, purpose-built for ML serving |
| ML / Feature Eng | Pandas, NumPy, scikit-learn | Industry standard |
| LLM Layer | Anthropic Claude Haiku | Fast, cheap, explains risk scores in plain English |
| Database | Supabase (Postgres + pgvector) | Auth + DB + vector search in one |
| Cache | Redis (Upstash) | Feature caching, rate limiting, Celery broker |
| Task Queue | Celery + Redis | Async ingestion, daily score computation |
| Auth | Strava OAuth2 + Supabase Auth | Real OAuth, not mocked |
| Deployment | Vercel (frontend) + Railway (backend) | Free tiers, one-click deploy |
| Monitoring | Sentry + structured logging | Production observability |
| CI/CD | GitHub Actions | Auto-deploy on push to main |

---

## ML Feature Engineering

Features computed per athlete per day. This is what makes the project technically credible.

### Load Metrics

| Feature | Formula | What It Tells You |
|---|---|---|
| ATL (Acute Training Load) | 7-day EWA of TSS | Short-term fatigue — how tired are you right now |
| CTL (Chronic Training Load) | 42-day EWA of TSS | Fitness baseline — how fit are you overall |
| TSB (Training Stress Balance) | CTL − ATL | Form score — positive means fresh, negative means tired |
| ACWR (Acute:Chronic Workload Ratio) | ATL ÷ CTL | Injury risk proxy — above 1.5 is the danger zone |
| Training Monotony | Mean weekly load ÷ StdDev | Lack of variation signals burnout risk |
| Training Strain | Weekly load × Monotony | Combined fatigue signal |

**TSS is computed from raw HR streams** (second-by-second data from Strava's Streams API), not estimated from summary stats. This gives accurate, sport-specific training stress rather than a rough approximation.

### Training Zone Breakdown *(SWE feature)*

Pulls the full HR time-series stream per activity (up to 10,000 data points). Computes minutes in each of 5 HR zones per session, then aggregates weekly. Surfaces a polarization score — elite training science recommends ~80% easy (Z1–Z2), ~20% hard (Z4–Z5). Most recreational athletes invert this.

**What the user sees:**
> "Last week you spent 74% of your time in Zone 4–5. This imbalance explains 31 points of your risk score. Try two easy Z2 runs before your next hard effort."

**Why it's a real engineering problem:** Strava rate-limits at 100 req/15 min and 1,000 req/day. Pulling streams for 90 days of activities requires a rate-limit-aware batching queue, not just a loop. The pipeline must gracefully resume on failure and prioritize recent activities.

### Drift Detection

- Rolling 30-day baseline computed per athlete
- KL divergence between current week's load distribution and baseline
- PSI (Population Stability Index) alert when drift > 0.2
- Seasonal adjustment for athletes with clear off-season patterns

### Risk Scorer

- Logistic regression trained on labeled synthetic dataset (overreaching events)
- Features: ACWR, monotony, strain, days since rest, volume delta, zone imbalance score
- Output: risk score 0–100 + top 3 contributing factors with SHAP values
- Score explained in plain English by Claude Haiku

### Per-Athlete Bayesian Calibration *(MLE feature)*

The population model is a starting point. Every athlete is different — some can sustain a higher ACWR, others are more fragile. After each training block, a simple feedback button ("that block felt: too hard / about right / easy") updates a per-athlete Beta-Binomial model via conjugate update. No retraining required.

After ~8 feedback events (~6–8 weeks), the model has enough signal to personalize risk thresholds. An athlete who consistently handles high load without issue gets their danger zone recalibrated upward. One who reports soreness at moderate loads gets a tighter threshold.

**What the user sees:**
> "Your personal threshold is higher than average — your model has learned from 9 weeks of your data. A score of 68 is moderate for you, not high."

**Cold-start handling:** New athletes start from the population prior. The UI is honest about this — it shows a confidence indicator that increases as more feedback data accumulates.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Frontend                      │
│       Dashboard · Zone Chart · Score History            │
└──────────────────────┬──────────────────────────────────┘
                       │ REST / HTTPS
┌──────────────────────▼──────────────────────────────────┐
│                   FastAPI Backend                        │
│                                                         │
│  ┌──────────────┐  ┌─────────────────┐  ┌───────────┐  │
│  │ Strava OAuth │  │ Feature Pipeline │  │ LLM Layer │  │
│  │ + Streams    │  │ + Zone Breakdown │  │  (Haiku)  │  │
│  └──────┬───────┘  └────────┬────────┘  └─────┬─────┘  │
│         │                   │                  │        │
│  ┌──────▼───────────────────▼──────────────────▼─────┐  │
│  │          Celery Task Queue (Redis broker)         │  │
│  └──────────────────────┬────────────────────────────┘  │
└─────────────────────────┼───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│                   Supabase (Postgres)                    │
│  athletes · activities · hr_streams · daily_features    │
│  risk_scores · zone_distributions · recommendations     │
│  drift_events · feedback_events · athlete_model_state   │
└─────────────────────────────────────────────────────────┘
```

---

## Database Schema

```sql
-- Core tables
athletes          (id, strava_id, email, access_token_enc, refresh_token_enc,
                   token_expires_at, max_hr, created_at)

activities        (id, athlete_id, strava_activity_id, type, distance_m,
                   duration_s, elevation_m, avg_hr, tss, date, raw_data jsonb)

hr_streams        (id, activity_id, athlete_id, timestamps int[], heartrate int[],
                   watts int[], cadence int[], recorded_at)

daily_features    (id, athlete_id, date, atl, ctl, tsb, acwr, monotony,
                   strain, zone_imbalance_score, computed_at)

zone_distributions (id, athlete_id, week_start, z1_mins, z2_mins, z3_mins,
                    z4_mins, z5_mins, polarization_score, computed_at)

risk_scores       (id, athlete_id, date, score, top_factors jsonb,
                   shap_values jsonb, model_version)

athlete_model_state (id, athlete_id, alpha float, beta float,
                     n_observations int, last_updated, model_version)

feedback_events   (id, athlete_id, block_end_date, rating text,
                   -- 'too_hard' | 'about_right' | 'easy'
                   risk_score_at_time int, created_at)

recommendations   (id, athlete_id, date, text, action text, score_ref int,
                   tokens_used int, created_at)

drift_events      (id, athlete_id, detected_at, psi_score, kl_divergence,
                   feature_name, alert_sent)
```

---

## Project Phases

### Phase 0 — Foundation (Day 1, ~3 hours)
- [ ] Init monorepo: `/frontend` (Next.js) + `/backend` (FastAPI)
- [ ] Set up Supabase project, run schema migrations
- [ ] Configure `.env` files — **`.gitignore` committed first, before any other file**
- [ ] Deploy skeleton to Vercel + Railway (empty but live URLs)
- [ ] GitHub branch protection on `main` (require CI pass)

**Deliverable:** Live URLs exist. CI/CD pipeline runs on push.

---

### Phase 1 — Strava OAuth + Data Ingestion (Day 1–2, ~4 hours)
- [ ] Strava OAuth2 flow (authorize → callback → encrypt tokens → store)
- [ ] Token refresh logic (tokens expire every 6 hours)
- [ ] Ingest last 90 days of activities via Strava API
- [ ] Celery task for background ingestion (never block the request thread)
- [ ] Webhook listener for new activities (real-time updates)
- [ ] Store raw activity data in `activities` table

**Deliverable:** User connects Strava, 90 days of data in DB.

---

### Phase 2 — Feature Engineering Pipeline (Day 2, ~3 hours)
- [ ] Compute TSS per activity (sport-specific: run/ride/swim)
- [ ] Rolling ATL/CTL/TSB with exponential weighting (7-day and 42-day spans)
- [ ] ACWR, monotony, strain scores
- [ ] Store in `daily_features` table
- [ ] Unit tests for every formula — this is where subtle bugs hide

**Deliverable:** Full feature vector computable for any athlete, any date.

---

### Phase 3 — HR Streams Ingestion + Zone Breakdown (Day 2–3, ~4 hours)
- [ ] Strava Streams API integration (`/activities/{id}/streams?keys=heartrate,watts,cadence`)
- [ ] Rate-limit-aware batch ingestion queue (100 req/15 min hard limit)
- [ ] Store compressed streams in `hr_streams` table (int arrays, not JSON)
- [ ] Zone classification per activity (Z1–Z5 using % of max HR)
- [ ] Weekly polarization score computation
- [ ] Drift alert: flag when zone distribution shifts significantly from baseline
- [ ] Zone breakdown visible in dashboard with plain-English summary

**Deliverable:** Per-athlete weekly zone distribution, polarization score, and zone-aware drift alerts.

---

### Phase 4 — Risk Scorer + Drift Detection (Day 3, ~3 hours)
- [ ] Train logistic regression on synthetic overreaching dataset
- [ ] Serialize with joblib, version as `model_v1.joblib`
- [ ] Add SHAP values to explain each score (top 3 contributing factors)
- [ ] `POST /score/{athlete_id}` → score + factors + SHAP breakdown
- [ ] Rolling baseline per athlete
- [ ] KL divergence + PSI computation
- [ ] Write drift events, trigger notification

**Deliverable:** Risk score 0–100 with SHAP-explained factors + drift alerts.

---

### Phase 5 — Bayesian Per-Athlete Calibration (Day 3–4, ~3 hours)
- [ ] Population prior: Beta(α, β) initialized from logistic regression output distribution
- [ ] Feedback endpoint: `POST /feedback` accepts block rating + stores in `feedback_events`
- [ ] Beta-Binomial conjugate update: α += hard_count, β += easy_count
- [ ] Store model state in `athlete_model_state` table (alpha, beta, n_observations)
- [ ] Adjusted score = population_score × personal_calibration_factor
- [ ] Cold-start UI: show confidence indicator ("based on 3 weeks of your data")
- [ ] "How did that block feel?" prompt surfaces in UI after 7+ day training blocks

**Deliverable:** Personalized risk thresholds that converge after ~8 feedback events.

---

### Phase 6 — LLM Recommendation Layer (Day 4, ~2 hours)
- [ ] Claude Haiku integration via Anthropic SDK (async)
- [ ] System prompt: sports coach persona with athlete's metrics, zone breakdown, calibration state
- [ ] Recommendation: train / easy / rest + 2-sentence reason
- [ ] Redis cache: key = `rec:{athlete_id}:{date}:{score}`, TTL 24h
- [ ] Token usage logged per recommendation

**Deliverable:** Every score has a plain-English explanation. Recommendations are zone-aware and personalized.

---

### Phase 7 — Frontend Dashboard (Day 4–5, ~4 hours)
- [ ] Landing page with Strava connect button
- [ ] Auth flow (Supabase session management)
- [ ] Dashboard: risk dial (big number, color-coded), recommendation, calibration confidence
- [ ] Zone distribution chart: stacked bar, weekly view, polarization annotation
- [ ] Training load chart: ATL/CTL/TSB over 6 weeks (Recharts)
- [ ] Drift alert banner (PSI > 0.2)
- [ ] Activity feed with TSS per activity
- [ ] Feedback widget: "How did that block feel?" after long training blocks
- [ ] Mobile responsive (single column at <768px)

**Color coding for risk score:**
- 0–30: Teal — low risk, train
- 31–55: Blue — moderate, easy day OK
- 56–75: Amber — high, back off
- 76–100: Coral/Red — danger, rest

**Deliverable:** Working dashboard at live Vercel URL. User understands everything they see.

---

### Phase 8 — Observability + Polish (Day 5, ~2 hours)
- [ ] Sentry on frontend and backend
- [ ] `/health` endpoint for Railway uptime monitoring
- [ ] Request latency logging middleware
- [ ] Rate limiting via `slowapi` (Redis-backed)
- [ ] README with architecture diagram, setup instructions, demo GIF
- [ ] `.env.example` with all variable names, no values

**Deliverable:** Production-grade. Shareable link. LinkedIn post ready.

---

## Security

- Strava `access_token` and `refresh_token` are **AES-256 encrypted** (Fernet) before writing to Supabase
- Tokens decrypted only inside `services/strava.py`, immediately before API calls
- Supabase Row-Level Security enabled on all tables — athletes can only access their own data
- CORS allow-list set explicitly — never `["*"]` in production
- JWT required on all `/api/*` endpoints
- Strava webhooks verified via HMAC-SHA256 signature
- Rate limiting on all endpoints (10 req/min on LLM endpoint for cost control)
- `.gitignore` committed before any other file — secrets never touch git history

---

## Environment Variables

```bash
# Backend (.env)
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_REDIRECT_URI=
STRAVA_VERIFY_TOKEN=        # For webhook subscription verification

SUPABASE_URL=
SUPABASE_SERVICE_KEY=

ANTHROPIC_API_KEY=

REDIS_URL=
CELERY_BROKER_URL=

SECRET_KEY=                 # For AES token encryption + JWT signing
FRONTEND_URL=               # For CORS allow-list

SENTRY_DSN=
ENVIRONMENT=development

# Frontend (.env.local)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=
```

---

## Repository Structure

```
athlete-intelligence/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth.py           # Strava OAuth endpoints
│   │   │   ├── athletes.py       # Athlete profile
│   │   │   ├── scores.py         # Risk score endpoints
│   │   │   └── webhooks.py       # Strava webhook receiver
│   │   ├── core/
│   │   │   ├── config.py         # Pydantic Settings (all env vars)
│   │   │   ├── database.py       # Supabase async client
│   │   │   ├── security.py       # AES encryption, JWT helpers
│   │   │   └── logging.py        # Structured logging
│   │   ├── ml/
│   │   │   ├── features.py       # ATL/CTL/TSB/ACWR/monotony/strain
│   │   │   ├── zones.py          # HR stream → zone breakdown pipeline
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
│   │   ├── test_features.py      # Unit tests for every formula
│   │   ├── test_zones.py
│   │   ├── test_bayesian.py
│   │   └── test_risk_scorer.py
│   ├── alembic/                  # DB migrations
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
│   │   ├── FeedbackWidget.tsx    # "How did that block feel?"
│   │   └── CalibrationBadge.tsx  # Confidence indicator
│   └── lib/
│       ├── api.ts                # Typed API client
│       └── supabase.ts
├── .github/workflows/
│   ├── deploy-backend.yml
│   └── deploy-frontend.yml
├── .gitignore                    # Committed first. Always.
├── CLAUDE.md                     # Instructions for Claude Code
└── README.md
```

---

## Local Development

```bash
# 1. Clone
git clone https://github.com/you/athlete-intelligence && cd athlete-intelligence

# 2. Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env       # fill in all values
uvicorn app.main:app --reload --port 8000

# 3. Redis (Docker)
docker run -d -p 6379:6379 redis:alpine

# 4. Celery worker (separate terminal)
celery -A app.services.tasks worker --loglevel=info

# 5. Frontend
cd ../frontend
npm install
cp .env.local.example .env.local    # fill in all values
npm run dev

# 6. Tests
cd backend && pytest tests/ -v
```

---

## Resume Bullets

```
• Designed async HR time-series ingestion pipeline processing Strava activity
  streams (10K points/activity) with rate-limit-aware batching (100 req/15 min),
  computing per-athlete weekly training zone distributions and surfacing
  polarization imbalance as a contributing factor to injury risk scores

• Implemented per-athlete Bayesian risk calibration using Beta-Binomial conjugate
  updates on athlete-reported training outcomes, personalizing injury probability
  thresholds that converge from population priors after ~8 feedback events, with
  model state versioned per athlete in Postgres

• Built end-to-end athlete load monitoring platform ingesting real Strava OAuth
  data, engineering 6 training load features (ATL/CTL/TSB/ACWR) with SHAP-based
  explainability, serving ML risk scores via FastAPI with sub-200ms p99 latency

• Integrated Claude Haiku as a personalized coaching layer generating plain-English
  risk explanations with token usage tracking and Redis response caching to
  minimize inference cost
```

---

## What This Demonstrates

| What They See | What It Signals |
|---|---|
| Rate-limited stream ingestion pipeline | You understand real API constraints, not just happy-path integration |
| Beta-Binomial online learning | You know production ML patterns: cold start, online updates, uncertainty quantification |
| SHAP explainability on risk scores | You think about ML interpretability, not just accuracy |
| AES-encrypted OAuth tokens | You take security seriously at the data layer, not just at the API layer |
| Celery async task queue | You know how to design systems that don't block under load |
| Plain-English explanations for every score | You build for users, not just for engineers |

---

## Roadmap (Post-Portfolio)

- Power-based TSS using normalized power from cycling power meters
- Multi-sport CTL normalization for triathletes
- HRV integration from Garmin/Apple Health
- Coach dashboard — monitor multiple athletes
- Connect to HabitOS personal operating system

---

*Built by Venkata Revanth Jyothula — [LinkedIn](#) · [GitHub](#)*
