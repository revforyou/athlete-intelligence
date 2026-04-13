import numpy as np
import pandas as pd
import pytest

from app.ml.features import compute_ewa, compute_features, compute_tss


class TestComputeTSS:
    def test_run_tss(self):
        tss = compute_tss("Run", duration_s=3600, avg_hr=152, athlete_max_hr=190)
        expected = (3600 / 3600) * (152 / 190) * 100
        assert abs(tss - expected) < 0.01

    def test_ride_tss(self):
        tss = compute_tss("Ride", duration_s=7200, avg_hr=160, athlete_max_hr=200)
        expected = (7200 / 3600) * (160 / 200) * 90
        assert abs(tss - expected) < 0.01

    def test_other_activity_tss(self):
        tss = compute_tss("Walk", duration_s=3600, avg_hr=120, athlete_max_hr=190)
        expected = (3600 / 3600) * 60
        assert abs(tss - expected) < 0.01

    def test_zero_duration(self):
        tss = compute_tss("Run", duration_s=0, avg_hr=150, athlete_max_hr=190)
        assert tss == 0.0

    def test_default_max_hr(self):
        tss = compute_tss("Run", duration_s=3600, avg_hr=190)
        assert abs(tss - 100.0) < 0.01


class TestComputeEWA:
    def test_atl_span(self):
        series = pd.Series([100.0] * 30)
        ewa = compute_ewa(series, span_days=7)
        # After many observations, EWA of constant series converges to that value
        assert abs(ewa.iloc[-1] - 100.0) < 1.0

    def test_ewa_decay(self):
        # After a spike then zeros, EWA should decay
        data = [0.0] * 20 + [100.0] + [0.0] * 10
        series = pd.Series(data)
        ewa = compute_ewa(series, span_days=7)
        # Last value should be less than 100
        assert ewa.iloc[-1] < 100.0
        assert ewa.iloc[-1] > 0.0

    def test_ewa_length_preserved(self):
        series = pd.Series(range(50), dtype=float)
        ewa = compute_ewa(series, span_days=42)
        assert len(ewa) == 50


class TestComputeFeatures:
    def _make_series(self, n=60):
        idx = pd.date_range("2024-01-01", periods=n, freq="D")
        rng = np.random.default_rng(42)
        values = rng.uniform(0, 150, n)
        return pd.Series(values, index=idx)

    def test_returns_dataframe(self):
        series = self._make_series()
        df = compute_features(series)
        assert isinstance(df, pd.DataFrame)

    def test_all_columns_present(self):
        series = self._make_series()
        df = compute_features(series)
        for col in ["tss", "atl", "ctl", "tsb", "acwr", "monotony", "strain"]:
            assert col in df.columns, f"Missing column: {col}"

    def test_tsb_equals_ctl_minus_atl(self):
        series = self._make_series()
        df = compute_features(series)
        diff = (df["ctl"] - df["atl"] - df["tsb"]).abs()
        assert diff.max() < 1e-9

    def test_acwr_equals_atl_over_ctl(self):
        series = self._make_series()
        df = compute_features(series)
        # Where CTL > 0, ACWR = ATL/CTL
        mask = df["ctl"] > 0
        ratio = df.loc[mask, "atl"] / df.loc[mask, "ctl"]
        diff = (ratio - df.loc[mask, "acwr"]).abs()
        assert diff.max() < 1e-9

    def test_atl_span_shorter_than_ctl(self):
        # ATL (7-day) reacts faster than CTL (42-day)
        # After a big load spike, ATL should be > CTL
        idx = pd.date_range("2024-01-01", periods=60, freq="D")
        values = [10.0] * 50 + [300.0] * 10
        series = pd.Series(values, index=idx)
        df = compute_features(series)
        assert df["atl"].iloc[-1] > df["ctl"].iloc[-1]

    def test_monotony_formula(self):
        idx = pd.date_range("2024-01-01", periods=20, freq="D")
        values = [100.0] * 20
        series = pd.Series(values, index=idx)
        df = compute_features(series)
        # With constant TSS, std is 0 → monotony would be inf/NaN → dropna removes those
        # A uniform signal should produce no finite monotony rows (all NaN dropped)
        # OR we test with non-uniform data
        idx2 = pd.date_range("2024-01-01", periods=30, freq="D")
        rng = np.random.default_rng(0)
        vals2 = rng.uniform(50, 150, 30)
        df2 = compute_features(pd.Series(vals2, index=idx2))
        assert "monotony" in df2.columns
        assert df2["monotony"].notna().any()

    def test_strain_is_positive_and_finite(self):
        # strain = rolling_sum(tss, 7) * monotony — computed on the original series
        # before dropna; we verify the result is finite and positive for valid rows.
        series = self._make_series()
        df = compute_features(series)
        assert (df["strain"] > 0).all()
        assert df["strain"].notna().all()
        assert df["strain"].apply(lambda x: x != float("inf")).all()

    def test_no_nan_after_dropna(self):
        series = self._make_series(n=90)
        df = compute_features(series)
        assert not df.isnull().any().any()
