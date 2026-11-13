from datetime import datetime, timezone
from typing import Any
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session
from app.models.models import HealthRecord, EnvironmentalRecord


def normalize_timestamp(ts: str | None) -> str:
    if not ts:
        return datetime.now(timezone.utc).isoformat()
    try:
        parsed = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc).isoformat()
    except ValueError:
        return datetime.now(timezone.utc).isoformat()


def clean_and_impute_health_payload(db: Session, astronaut_id: int, payload: dict[str, Any]) -> tuple[dict[str, Any], bool]:
    """
    Validates, normalizes timestamps, and applies personal-history median imputation
    for missing optional vital fields without masking provenance.
    """
    cleaned = dict(payload)
    cleaned["recorded_at"] = normalize_timestamp(cleaned.get("recorded_at"))
    missing_imputed = False

    numeric_fields = [
        "heart_rate_bpm",
        "spo2_pct",
        "sleep_duration_hrs",
        "stress_score",
        "mood_score",
        "activity_minutes",
    ]
    missing_keys = [k for k in numeric_fields if cleaned.get(k) is None]

    if missing_keys:
        history = (
            db.query(HealthRecord)
            .filter(HealthRecord.astronaut_id == astronaut_id)
            .order_by(HealthRecord.recorded_at.desc())
            .limit(14)
            .all()
        )
        if history:
            for key in missing_keys:
                vals = [getattr(r, key) for r in history if getattr(r, key) is not None]
                if vals:
                    med = float(np.median(vals))
                    cleaned[key] = int(round(med)) if key == "activity_minutes" else round(med, 2)
                    missing_imputed = True

    return cleaned, missing_imputed


def engineer_health_features(records: list[HealthRecord], env_records: list[EnvironmentalRecord]) -> pd.DataFrame:
    """
    Builds a clean, normalized Pandas feature dataframe joining personal physiological
    rolling features with nearest-timestamp habitat environmental telemetry.
    """
    if not records:
        return pd.DataFrame()

    rows = [
        {
            "id": r.id,
            "astronaut_id": r.astronaut_id,
            "recorded_at": r.recorded_at,
            "heart_rate_bpm": r.heart_rate_bpm,
            "spo2_pct": r.spo2_pct,
            "sleep_duration_hrs": r.sleep_duration_hrs,
            "sleep_quality_score": r.sleep_quality_score or 75.0,
            "activity_minutes": r.activity_minutes or 0,
            "stress_score": r.stress_score or 3.0,
            "mood_score": r.mood_score or 7.0,
            "data_source": r.data_source,
        }
        for r in records
    ]
    df = pd.DataFrame(rows)
    df["ts"] = pd.to_datetime(df["recorded_at"], utc=True)
    df = df.sort_values("ts").reset_index(drop=True)

    # Personal causal rolling 7-day baselines & deviations (no future bfill leakage)
    for col in ["heart_rate_bpm", "spo2_pct", "sleep_duration_hrs", "stress_score", "mood_score"]:
        df[col] = df[col].ffill()
        if df[col].isna().any():
            first_valid = df[col].dropna().iloc[0] if not df[col].dropna().empty else 0.0
            df[col] = df[col].fillna(first_valid)
        df[f"{col}_roll_mean"] = df[col].rolling(window=7, min_periods=1).mean()
        df[f"{col}_roll_std"] = df[col].rolling(window=7, min_periods=2).std().fillna(1.0).replace(0, 1.0)
        df[f"{col}_z"] = (df[col] - df[f"{col}_roll_mean"]) / df[f"{col}_roll_std"]

    # Composite physiological strain proxy (non-diagnostic exploratory index)
    df["recovery_balance_index"] = (
        (df["sleep_duration_hrs"] / 7.5) * 0.4
        + ((10.0 - df["stress_score"]) / 10.0) * 0.35
        + (df["spo2_pct"] / 100.0) * 0.25
    )

    if env_records:
        env_df = pd.DataFrame(
            [
                {
                    "env_ts": pd.to_datetime(e.recorded_at, utc=True),
                    "cabin_co2_ppm": e.cabin_co2_ppm,
                    "radiation_msv_day": e.radiation_msv_day,
                    "temperature_c": e.temperature_c,
                    "humidity_pct": e.humidity_pct,
                }
                for e in env_records
            ]
        ).sort_values("env_ts")
        df = pd.merge_asof(
            df,
            env_df,
            left_on="ts",
            right_on="env_ts",
            direction="backward",
            tolerance=pd.Timedelta("24h"),
        )
    else:
        df["cabin_co2_ppm"] = 2100.0
        df["radiation_msv_day"] = 0.62
        df["temperature_c"] = 22.0
        df["humidity_pct"] = 45.0

    for env_col, default_val in [
        ("cabin_co2_ppm", 2100.0),
        ("radiation_msv_day", 0.62),
        ("temperature_c", 22.0),
        ("humidity_pct", 45.0),
    ]:
        df[env_col] = df[env_col].ffill().fillna(default_val)

    return df
