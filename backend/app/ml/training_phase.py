from typing import List

import numpy as np


def classify_training_phase(features_history: List[dict]) -> dict:
    """
    Classify current training phase from recent load metrics.
    Returns phase, emoji, confidence, reasoning, and guidance.
    """
    if len(features_history) < 7:
        return {
            "phase": "unknown",
            "emoji": "❓",
            "confidence": "low",
            "reasoning": "Not enough data to classify training phase yet.",
            "guidance": "Log more activities over the next 1–2 weeks.",
            "metrics": {},
        }

    last = features_history[-1]
    ctl = last.get("ctl") or 0
    atl = last.get("atl") or 0
    tsb = last.get("tsb") or 0
    acwr = last.get("acwr") or 1.0

    # CTL trend over last 4 weeks
    older = features_history[-28:-7] if len(features_history) >= 28 else features_history[:-7]
    ctl_trend = (ctl - float(np.mean([r.get("ctl") or 0 for r in older]))) if older else 0

    # TSB trend over last week
    week_ago = features_history[-8] if len(features_history) >= 8 else features_history[0]
    tsb_trend = tsb - (week_ago.get("tsb") or 0)

    if tsb > 10 and ctl_trend <= 2:
        phase, emoji = "recovery", "🛋️"
        reasoning = f"TSB is {tsb:.0f} (very fresh) with flat/declining load — recovery phase."
        guidance = "Keep volume low, easy aerobic only. Let the body rebuild."
        confidence = "high"

    elif tsb_trend > 8 and ctl_trend < 0 and tsb > 0:
        phase, emoji = "taper", "🏁"
        reasoning = f"Freshness rising fast (+{tsb_trend:.0f} this week) while fitness declining — tapering."
        guidance = "Short quality sessions only. Trust the fitness you've built."
        confidence = "high"

    elif ctl > 40 and -5 <= tsb <= 12 and acwr <= 1.25:
        phase, emoji = "peak", "🔥"
        reasoning = f"High fitness ({ctl:.0f} CTL) with good form (TSB {tsb:.0f}) — near peak."
        guidance = "Race or time trial window. Protect this form, no new stress."
        confidence = "high"

    elif ctl_trend > 3 and 0.95 <= acwr <= 1.40:
        phase, emoji = "build", "📈"
        reasoning = f"CTL rising {ctl_trend:+.0f} over 4 weeks with healthy ACWR ({acwr:.2f}) — build phase."
        guidance = "Progressive overload is working. Mix quality with aerobic volume."
        confidence = "medium"

    elif ctl_trend >= 0 and acwr < 1.05:
        phase, emoji = "base", "🧱"
        reasoning = f"Aerobic base building, controlled load (ACWR {acwr:.2f}). Slow fitness accumulation."
        guidance = "Focus on easy aerobic volume. Resist adding intensity too soon."
        confidence = "medium"

    else:
        phase, emoji = "transition", "🔄"
        reasoning = "Training pattern doesn't fit a standard phase — likely between phases."
        guidance = "Focus on consistency and monitor how the body responds."
        confidence = "low"

    return {
        "phase": phase,
        "emoji": emoji,
        "confidence": confidence,
        "reasoning": reasoning,
        "guidance": guidance,
        "metrics": {
            "ctl": round(ctl, 1),
            "atl": round(atl, 1),
            "tsb": round(tsb, 1),
            "acwr": round(acwr, 2),
            "ctl_trend_4w": round(ctl_trend, 1),
            "tsb_trend_1w": round(tsb_trend, 1),
        },
    }
