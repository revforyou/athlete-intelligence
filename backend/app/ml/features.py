import numpy as np
import pandas as pd


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
