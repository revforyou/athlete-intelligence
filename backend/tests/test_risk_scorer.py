import numpy as np
import pytest

from app.ml.risk_scorer import (
    FEATURE_COLS,
    _generate_synthetic_data,
    score_athlete,
    train_model,
)


class TestSyntheticDataGeneration:
    def test_shape(self):
        X, y = _generate_synthetic_data(500)
        assert X.shape == (500, len(FEATURE_COLS))
        assert y.shape == (500,)

    def test_binary_labels(self):
        _, y = _generate_synthetic_data(200)
        assert set(y).issubset({0, 1})

    def test_both_classes_present(self):
        _, y = _generate_synthetic_data(500)
        assert 0 in y and 1 in y

    def test_feature_ranges(self):
        X, _ = _generate_synthetic_data(1000)
        # ACWR: 0.5 – 2.0
        assert X[:, 0].min() >= 0.5
        assert X[:, 0].max() <= 2.0
        # days_since_rest: 0 – 13
        assert X[:, 3].min() >= 0


class TestTrainModel:
    def test_returns_pipeline(self):
        from sklearn.pipeline import Pipeline
        model = train_model()
        assert isinstance(model, Pipeline)

    def test_pipeline_has_scaler_and_clf(self):
        model = train_model()
        assert "scaler" in model.named_steps
        assert "clf" in model.named_steps

    def test_model_file_created(self):
        import os
        from app.ml.risk_scorer import MODEL_PATH
        train_model()
        assert os.path.exists(MODEL_PATH)


class TestScoreAthlete:
    def _sample_features(self, **overrides):
        defaults = {
            "acwr": 1.0,
            "monotony": 1.2,
            "strain": 150.0,
            "days_since_rest": 3.0,
            "volume_delta_pct": 0.0,
            "zone_imbalance_score": 0.4,
        }
        defaults.update(overrides)
        return defaults

    def test_returns_required_keys(self):
        result = score_athlete(self._sample_features())
        assert "score" in result
        assert "top_factors" in result
        assert "model_version" in result

    def test_score_in_range(self):
        result = score_athlete(self._sample_features())
        assert 0 <= result["score"] <= 100

    def test_top_factors_length(self):
        result = score_athlete(self._sample_features())
        assert len(result["top_factors"]) == 3

    def test_top_factors_keys(self):
        result = score_athlete(self._sample_features())
        for f in result["top_factors"]:
            assert "name" in f
            assert "value" in f
            assert "shap" in f

    def test_high_acwr_increases_score(self):
        low = score_athlete(self._sample_features(acwr=0.8))
        high = score_athlete(self._sample_features(acwr=1.8))
        assert high["score"] >= low["score"]

    def test_missing_features_use_defaults(self):
        # Only pass partial features — should not raise
        result = score_athlete({"acwr": 1.2})
        assert 0 <= result["score"] <= 100

    def test_model_version(self):
        result = score_athlete(self._sample_features())
        assert result["model_version"] == "v1"
