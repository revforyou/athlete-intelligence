from typing import List

import numpy as np


def _safe_kl_divergence(p: np.ndarray, q: np.ndarray, epsilon: float = 1e-10) -> float:
    p = np.asarray(p, dtype=float) + epsilon
    q = np.asarray(q, dtype=float) + epsilon
    p = p / p.sum()
    q = q / q.sum()
    return float(np.sum(p * np.log(p / q)))


def compute_psi(expected: np.ndarray, actual: np.ndarray, buckets: int = 10) -> float:
    breakpoints = np.percentile(expected, np.linspace(0, 100, buckets + 1))
    breakpoints[0] -= 1e-10
    breakpoints[-1] += 1e-10

    expected_counts = np.histogram(expected, bins=breakpoints)[0]
    actual_counts = np.histogram(actual, bins=breakpoints)[0]

    expected_pct = (expected_counts + 1e-6) / (len(expected) + 1e-6 * buckets)
    actual_pct = (actual_counts + 1e-6) / (len(actual) + 1e-6 * buckets)

    psi = np.sum((actual_pct - expected_pct) * np.log(actual_pct / expected_pct))
    return float(psi)


def detect_drift(
    baseline_values: List[float],
    current_values: List[float],
    feature_name: str,
    psi_threshold: float = 0.2,
) -> dict:
    if len(baseline_values) < 10 or len(current_values) < 5:
        return {"drift_detected": False, "psi_score": 0.0, "kl_divergence": 0.0}

    baseline = np.array(baseline_values, dtype=float)
    current = np.array(current_values, dtype=float)

    psi = compute_psi(baseline, current)
    kl = _safe_kl_divergence(
        np.histogram(baseline, bins=10)[0],
        np.histogram(current, bins=10)[0],
    )

    return {
        "drift_detected": psi > psi_threshold,
        "psi_score": round(psi, 4),
        "kl_divergence": round(kl, 4),
        "feature_name": feature_name,
    }
