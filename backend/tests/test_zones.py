import pytest

from app.ml.zones import (
    classify_hr_to_zone,
    compute_polarization_score,
    compute_weekly_zones,
    compute_zone_minutes,
    detect_zone_drift,
)


class TestClassifyHrToZone:
    def test_z1(self):
        assert classify_hr_to_zone(100, 200) == 1  # 50% < 60%

    def test_z2(self):
        assert classify_hr_to_zone(130, 200) == 2  # 65%

    def test_z3(self):
        assert classify_hr_to_zone(150, 200) == 3  # 75%

    def test_z4(self):
        assert classify_hr_to_zone(170, 200) == 4  # 85%

    def test_z5(self):
        assert classify_hr_to_zone(185, 200) == 5  # 92.5%

    def test_boundary_z1_z2(self):
        # Exactly 60% → Z2
        assert classify_hr_to_zone(120, 200) == 2

    def test_boundary_z4_z5(self):
        # Exactly 90% → Z5
        assert classify_hr_to_zone(180, 200) == 5


class TestComputeZoneMinutes:
    def test_all_z1(self):
        hr = [100] * 60  # all below 60% of 200
        ts = list(range(60))
        result = compute_zone_minutes(hr, ts, max_hr=200)
        assert result["z1_mins"] > 0
        assert result["z2_mins"] == 0
        assert result["z5_mins"] == 0

    def test_mixed_zones(self):
        hr = [100, 130, 150, 170, 190]
        ts = [0, 60, 120, 180, 240]
        result = compute_zone_minutes(hr, ts, max_hr=200)
        for key in ["z1_mins", "z2_mins", "z3_mins", "z4_mins", "z5_mins"]:
            assert key in result
            assert result[key] >= 0

    def test_single_point(self):
        result = compute_zone_minutes([150], [0], max_hr=200)
        # Single point: dt = 1s = 1/60 mins in z3
        assert result["z3_mins"] > 0
        assert result["z3_mins"] < 0.1

    def test_total_time_preserved(self):
        hr = [100, 130, 160, 175, 190]
        ts = [0, 60, 120, 180, 240]
        result = compute_zone_minutes(hr, ts, max_hr=200)
        total = sum(result.values())
        # Total should be ~4 minutes (240s of elapsed time)
        assert 3.5 < total < 4.5


class TestComputePolarizationScore:
    def test_all_easy(self):
        zones = {"z1_mins": 60.0, "z2_mins": 30.0, "z3_mins": 10.0, "z4_mins": 0.0, "z5_mins": 0.0}
        assert compute_polarization_score(zones) == 0.0

    def test_all_hard(self):
        zones = {"z1_mins": 0.0, "z2_mins": 0.0, "z3_mins": 0.0, "z4_mins": 60.0, "z5_mins": 60.0}
        assert compute_polarization_score(zones) == 100.0

    def test_mixed(self):
        zones = {"z1_mins": 40.0, "z2_mins": 30.0, "z3_mins": 10.0, "z4_mins": 15.0, "z5_mins": 5.0}
        total = 100.0
        expected = (15 + 5) / total * 100
        assert abs(compute_polarization_score(zones) - expected) < 0.01

    def test_zero_total(self):
        zones = {"z1_mins": 0.0, "z2_mins": 0.0, "z3_mins": 0.0, "z4_mins": 0.0, "z5_mins": 0.0}
        assert compute_polarization_score(zones) == 0.0


class TestComputeWeeklyZones:
    def test_aggregates_correctly(self):
        activities = [
            {"z1_mins": 10, "z2_mins": 5, "z3_mins": 3, "z4_mins": 2, "z5_mins": 1},
            {"z1_mins": 20, "z2_mins": 10, "z3_mins": 5, "z4_mins": 3, "z5_mins": 2},
        ]
        result = compute_weekly_zones(activities)
        assert result["z1_mins"] == 30
        assert result["z2_mins"] == 15
        assert "polarization_score" in result

    def test_empty_list(self):
        result = compute_weekly_zones([])
        assert result["z1_mins"] == 0.0
        assert result["polarization_score"] == 0.0


class TestDetectZoneDrift:
    def test_no_drift(self):
        baseline = [{"z1_mins": 40, "z2_mins": 20, "z3_mins": 10, "z4_mins": 5, "z5_mins": 5}] * 4
        current = {"z1_mins": 40, "z2_mins": 20, "z3_mins": 10, "z4_mins": 5, "z5_mins": 5}
        result = detect_zone_drift(current, baseline)
        assert result is None

    def test_drift_detected(self):
        # Baseline: mostly easy training
        baseline = [{"z1_mins": 60, "z2_mins": 20, "z3_mins": 10, "z4_mins": 5, "z5_mins": 5}] * 4
        # Current: heavily shifted to hard
        current = {"z1_mins": 10, "z2_mins": 10, "z3_mins": 10, "z4_mins": 40, "z5_mins": 30}
        result = detect_zone_drift(current, baseline)
        assert result is not None
        assert "shifted" in result.lower()

    def test_insufficient_baseline(self):
        baseline = [{"z1_mins": 60, "z2_mins": 20, "z3_mins": 10, "z4_mins": 5, "z5_mins": 5}]
        current = {"z1_mins": 10, "z2_mins": 10, "z3_mins": 10, "z4_mins": 40, "z5_mins": 30}
        result = detect_zone_drift(current, baseline)
        assert result is None
