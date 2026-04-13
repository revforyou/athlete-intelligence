import pytest

from app.ml.bayesian import get_calibrated_score, initialize_prior, update_model


class TestInitializePrior:
    def test_returns_beta_2_2(self):
        prior = initialize_prior()
        assert prior["alpha"] == 2.0
        assert prior["beta"] == 2.0
        assert prior["n_observations"] == 0

    def test_all_keys_present(self):
        prior = initialize_prior()
        assert "alpha" in prior
        assert "beta" in prior
        assert "n_observations" in prior


class TestUpdateModel:
    def test_too_hard_increments_alpha(self):
        state = initialize_prior()
        new_state = update_model(state, "too_hard")
        assert new_state["alpha"] == state["alpha"] + 1
        assert new_state["beta"] == state["beta"]
        assert new_state["n_observations"] == 1

    def test_easy_increments_beta(self):
        state = initialize_prior()
        new_state = update_model(state, "easy")
        assert new_state["alpha"] == state["alpha"]
        assert new_state["beta"] == state["beta"] + 1
        assert new_state["n_observations"] == 1

    def test_about_right_no_alpha_beta_change(self):
        state = initialize_prior()
        new_state = update_model(state, "about_right")
        assert new_state["alpha"] == state["alpha"]
        assert new_state["beta"] == state["beta"]
        assert new_state["n_observations"] == 1

    def test_multiple_updates_accumulate(self):
        state = initialize_prior()
        state = update_model(state, "too_hard")
        state = update_model(state, "too_hard")
        state = update_model(state, "easy")
        assert state["alpha"] == 2.0 + 2
        assert state["beta"] == 2.0 + 1
        assert state["n_observations"] == 3

    def test_invalid_rating_raises(self):
        state = initialize_prior()
        with pytest.raises(KeyError):
            update_model(state, "invalid_rating")


class TestGetCalibratedScore:
    def test_cold_start_returns_raw_score(self):
        state = {"alpha": 2.0, "beta": 2.0, "n_observations": 0}
        result = get_calibrated_score(state, 60)
        assert result["score"] == 60
        assert result["confidence"] == "low"

    def test_cold_start_at_3_observations(self):
        state = {"alpha": 3.0, "beta": 2.0, "n_observations": 3}
        result = get_calibrated_score(state, 50)
        assert result["score"] == 50
        assert result["confidence"] == "low"
        assert "3 of 8" in result["message"]

    def test_medium_confidence_at_5(self):
        state = {"alpha": 5.0, "beta": 3.0, "n_observations": 5}
        result = get_calibrated_score(state, 50)
        assert result["confidence"] == "medium"

    def test_high_confidence_at_8(self):
        state = {"alpha": 6.0, "beta": 4.0, "n_observations": 8}
        result = get_calibrated_score(state, 50)
        assert result["confidence"] == "high"
        assert result["message"] == "Calibrated to your data"

    def test_too_hard_tendency_increases_score(self):
        # Lots of "too_hard" ratings → alpha >> beta → tendency > 0.5 → positive adjustment
        state = {"alpha": 10.0, "beta": 2.0, "n_observations": 10}
        result = get_calibrated_score(state, 50)
        assert result["score"] > 50

    def test_easy_tendency_decreases_score(self):
        # Lots of "easy" ratings → beta >> alpha → tendency < 0.5 → negative adjustment
        state = {"alpha": 2.0, "beta": 10.0, "n_observations": 10}
        result = get_calibrated_score(state, 50)
        assert result["score"] < 50

    def test_score_clamped_to_0_100(self):
        state = {"alpha": 100.0, "beta": 2.0, "n_observations": 50}
        result = get_calibrated_score(state, 99)
        assert result["score"] <= 100

        state2 = {"alpha": 2.0, "beta": 100.0, "n_observations": 50}
        result2 = get_calibrated_score(state2, 1)
        assert result2["score"] >= 0

    def test_symmetric_tendency(self):
        # Alpha == Beta → tendency = 0.5 → no adjustment
        state = {"alpha": 5.0, "beta": 5.0, "n_observations": 8}
        result = get_calibrated_score(state, 60)
        assert result["score"] == 60
