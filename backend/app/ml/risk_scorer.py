import os

import joblib
import numpy as np
import shap
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

FEATURE_COLS = [
    "acwr",
    "monotony",
    "strain",
    "days_since_rest",
    "volume_delta_pct",
    "zone_imbalance_score",
]

MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "risk_model_v1.joblib")


def _generate_synthetic_data(n_samples: int = 1000):
    rng = np.random.default_rng(42)
    acwr = rng.uniform(0.5, 2.0, n_samples)
    monotony = rng.uniform(0.5, 3.0, n_samples)
    strain = rng.uniform(10, 500, n_samples)
    days_since_rest = rng.integers(0, 14, n_samples).astype(float)
    volume_delta_pct = rng.uniform(-50, 100, n_samples)
    zone_imbalance = rng.uniform(0, 1, n_samples)

    X = np.column_stack([acwr, monotony, strain, days_since_rest, volume_delta_pct, zone_imbalance])

    # Overreaching risk: high ACWR, monotony, strain are risk factors
    logit = (
        2.5 * (acwr - 1.3)
        + 0.8 * (monotony - 1.5)
        + 0.005 * (strain - 200)
        + 0.15 * days_since_rest
        + 0.01 * volume_delta_pct
        - 0.5
    )
    prob = 1 / (1 + np.exp(-logit))
    y = (rng.uniform(0, 1, n_samples) < prob).astype(int)
    return X, y


def train_model():
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    X, y = _generate_synthetic_data(1000)
    pipe = Pipeline(
        [("scaler", StandardScaler()), ("clf", LogisticRegression(C=1.0, max_iter=1000))]
    )
    pipe.fit(X, y)
    joblib.dump(pipe, MODEL_PATH)
    return pipe


def _load_model() -> Pipeline:
    if not os.path.exists(MODEL_PATH):
        return train_model()
    return joblib.load(MODEL_PATH)


def score_athlete(features: dict) -> dict:
    model = _load_model()

    # Fill missing features with neutral defaults
    feature_values = []
    for col in FEATURE_COLS:
        val = features.get(col)
        if val is None:
            defaults = {
                "acwr": 1.0,
                "monotony": 1.0,
                "strain": 100.0,
                "days_since_rest": 3.0,
                "volume_delta_pct": 0.0,
                "zone_imbalance_score": 0.5,
            }
            val = defaults.get(col, 0.0)
        feature_values.append(float(val))

    X = np.array([feature_values])
    score = int(model.predict_proba(X)[0][1] * 100)

    # SHAP explanation
    clf = model.named_steps["clf"]
    scaler = model.named_steps["scaler"]
    X_scaled = scaler.transform(X)
    background = shap.maskers.Independent(X_scaled, max_samples=50)
    explainer = shap.LinearExplainer(clf, background)
    shap_vals = explainer.shap_values(X_scaled)[0]

    factors = [
        {
            "name": col,
            "value": round(feature_values[i], 3),
            "shap": round(float(shap_vals[i]), 4),
        }
        for i, col in enumerate(FEATURE_COLS)
    ]
    top_factors = sorted(factors, key=lambda x: abs(x["shap"]), reverse=True)[:3]

    return {"score": score, "top_factors": top_factors, "model_version": "v1"}
