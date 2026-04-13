RATING_TO_UPDATE = {
    "too_hard":    {"alpha": 1, "beta": 0},
    "about_right": {"alpha": 0, "beta": 0},
    "easy":        {"alpha": 0, "beta": 1},
}


def initialize_prior() -> dict:
    return {"alpha": 2.0, "beta": 2.0, "n_observations": 0}


def update_model(state: dict, rating: str) -> dict:
    u = RATING_TO_UPDATE[rating]
    return {
        "alpha": state["alpha"] + u["alpha"],
        "beta": state["beta"] + u["beta"],
        "n_observations": state["n_observations"] + 1,
    }


def get_calibrated_score(state: dict, raw_score: int) -> dict:
    n = state["n_observations"]
    if n < 4:
        return {
            "score": raw_score,
            "confidence": "low",
            "message": f"Personalizing \u2014 {n} of 8 sessions logged",
        }
    tendency = state["alpha"] / (state["alpha"] + state["beta"])
    adjustment = (tendency - 0.5) * 20
    calibrated = int(min(100, max(0, raw_score + adjustment)))
    confidence = "medium" if n < 8 else "high"
    message = (
        f"Personalizing \u2014 {n} of 8 sessions logged"
        if n < 8
        else "Calibrated to your data"
    )
    return {"score": calibrated, "confidence": confidence, "message": message}
