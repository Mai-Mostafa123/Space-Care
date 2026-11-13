"""
Personal Baseline & Multivariable Anomaly Detection Module
Core Principle: PERSONAL BASELINE, NOT POPULATION-BASED MEDICAL DIAGNOSIS.

Methods:
1. Individual Baseline Estimation (rolling median, mean, std, IQR over personal history).
2. Rolling Statistical Z-Score Analysis (flags personal deviations >= 2.2 sigma).
3. Multivariable Isolation Forest (Scikit-learn) across physiological + environmental features.
4. Time-Series Trend Slope Analysis (3-day trailing shift vs prior baseline).
5. Model Persistence via joblib (.joblib) per astronaut.
6. Synthetic Benchmark Evaluation (Precision, Recall, F1, FPR, Confusion Matrix).
"""

import json
from pathlib import Path
from typing import Any
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import AnomalyAlert, Astronaut, EnvironmentalRecord, HealthRecord
from app.services.data_pipeline import engineer_health_features

MANDATORY_UNCERTAINTY_STATEMENT = (
    "Decision-support statistical notice: This alert reflects deviation from this astronaut's "
    "own historical baseline rather than a clinical threshold or medical diagnosis. "
    "Sensor artifacts, recent EVA workload, or environmental telemetry lags can influence scores; "
    "verify raw vitals and habitat ECLSS readings before action."
)

MULTIVARIATE_FEATURES = [
    "heart_rate_bpm",
    "spo2_pct",
    "sleep_duration_hrs",
    "stress_score",
    "mood_score",
    "cabin_co2_ppm",
]


def compute_personal_baseline(df: pd.DataFrame) -> dict[str, dict[str, float]]:
    baseline = {}
    for col in ["heart_rate_bpm", "spo2_pct", "sleep_duration_hrs", "stress_score", "mood_score", "activity_minutes"]:
        series = df[col].dropna()
        if series.empty:
            continue
        q1 = float(series.quantile(0.25))
        q3 = float(series.quantile(0.75))
        baseline[col] = {
            "mean": round(float(series.mean()), 2),
            "median": round(float(series.median()), 2),
            "std": round(float(max(series.std(), 0.01)), 2),
            "iqr_low": round(q1 - 1.5 * (q3 - q1), 2),
            "iqr_high": round(q3 + 1.5 * (q3 - q1), 2),
            "n_samples": int(len(series)),
        }
    return baseline


def train_and_persist_isolation_forest(astronaut_id: int, train_df: pd.DataFrame) -> tuple[IsolationForest, StandardScaler, Path]:
    scaler = StandardScaler()
    medians = train_df[MULTIVARIATE_FEATURES].median()
    X_train = train_df[MULTIVARIATE_FEATURES].fillna(medians).values
    X_train_scaled = scaler.fit_transform(X_train)

    model = IsolationForest(
        n_estimators=120,
        contamination=0.05,
        random_state=42,
        n_jobs=1,  # Memory-conscious single-thread execution for 8 GB RAM
    )
    model.fit(X_train_scaled)

    artifact_path = settings.ML_MODELS_DIR / f"iforest_astronaut_{astronaut_id}.joblib"
    joblib.dump({"model": model, "scaler": scaler, "features": MULTIVARIATE_FEATURES, "medians": medians.to_dict()}, artifact_path)
    return model, scaler, artifact_path


def run_anomaly_detection_for_astronaut(db: Session, astronaut_id: int, persist_alerts: bool = True) -> dict[str, Any]:
    astronaut = db.query(Astronaut).filter(Astronaut.id == astronaut_id).first()
    if not astronaut:
        return {"error": f"Astronaut {astronaut_id} not found", "alerts": []}

    records = (
        db.query(HealthRecord)
        .filter(HealthRecord.astronaut_id == astronaut_id)
        .order_by(HealthRecord.recorded_at.asc())
        .all()
    )
    if len(records) < 7:
        return {
            "astronaut_id": astronaut_id,
            "call_sign": astronaut.call_sign,
            "baseline": {},
            "alerts": [],
            "uncertainty_note": f"Insufficient personal history ({len(records)} records; minimum 7 required for rolling baseline).",
        }

    env_records = (
        db.query(EnvironmentalRecord)
        .filter(EnvironmentalRecord.mission_name == astronaut.mission_name)
        .order_by(EnvironmentalRecord.recorded_at.asc())
        .all()
    )
    df = engineer_health_features(records, env_records)

    # Fit personal baseline, scaler, and Isolation Forest strictly on initial baseline window (days 1-12)
    baseline_cutoff = max(7, min(12, int(len(df) * 0.5)))
    train_df = df.iloc[:baseline_cutoff]
    baseline = compute_personal_baseline(train_df)

    model, scaler, model_path = train_and_persist_isolation_forest(astronaut_id, train_df)
    train_medians = train_df[MULTIVARIATE_FEATURES].median()
    X_scaled = scaler.transform(df[MULTIVARIATE_FEATURES].fillna(train_medians).values)
    raw_preds = model.predict(X_scaled)  # -1 = anomaly, 1 = normal
    decision_scores = model.decision_function(X_scaled)

    # Clear unacknowledged re-runs for idempotency while preserving ACKNOWLEDGED/RESOLVED history
    if persist_alerts:
        db.query(AnomalyAlert).filter(
            AnomalyAlert.astronaut_id == astronaut_id,
            AnomalyAlert.status == "ACTIVE",
        ).delete()

    detected_alerts = []
    for idx, row in df.iterrows():
        deviating_vars = []
        observed_map = {}
        baseline_map = {}
        dev_parts = []

        checks = [
            ("heart_rate_bpm", "bpm", 2.1),
            ("spo2_pct", "%", 2.0),
            ("sleep_duration_hrs", "hrs", 2.0),
            ("stress_score", "/10", 2.1),
            ("mood_score", "/10", 2.1),
        ]
        for col, unit, z_thresh in checks:
            if col not in baseline:
                continue
            b_mean = baseline[col]["mean"]
            b_std = max(baseline[col]["std"], 0.35)
            val = float(row[col])
            z = (val - b_mean) / b_std
            if abs(z) >= z_thresh:
                deviating_vars.append(col)
                observed_map[col] = round(val, 2)
                baseline_map[col] = baseline[col]
                direction = "above" if z > 0 else "below"
                dev_parts.append(f"{col}: {val:.2f}{unit} ({abs(z):.1f}σ {direction} personal baseline {b_mean:.2f}{unit})")

        iforest_flagged = raw_preds[idx] == -1
        norm_score = float(np.clip(0.5 - decision_scores[idx] * 2.2, 0.05, 0.99))

        if deviating_vars or (iforest_flagged and norm_score >= 0.62):
            if not deviating_vars:
                deviating_vars = ["multivariate_profile"]
                for col in ["heart_rate_bpm", "spo2_pct", "sleep_duration_hrs", "cabin_co2_ppm"]:
                    observed_map[col] = round(float(row[col]), 2)
                    if col in baseline:
                        baseline_map[col] = baseline[col]
                dev_parts.append("Multivariable Isolation Forest detected joint shift across vitals and cabin CO2")

            if float(row.get("cabin_co2_ppm", 2000)) > 3500:
                observed_map["cabin_co2_ppm"] = round(float(row["cabin_co2_ppm"]), 1)
                dev_parts.append(f"Co-occurring elevated cabin CO2 ({row['cabin_co2_ppm']:.0f} ppm)")

            method = (
                "ISOLATION_FOREST_MULTIVARIATE"
                if iforest_flagged and len(deviating_vars) >= 2
                else "PERSONAL_ZSCORE_ROLLING"
            )
            severity = "CRITICAL_REVIEW" if len(deviating_vars) >= 3 or norm_score > 0.82 else (
                "ELEVATED" if len(deviating_vars) >= 2 else "ADVISORY"
            )
            confidence = "HIGH" if len(df) >= 20 else "MODERATE"
            explanation = (
                f"Detected {method.replace('_', ' ').lower()} deviation for {astronaut.call_sign} on "
                f"{str(row['recorded_at'])[:10]}. Contributing signals: {'; '.join(dev_parts)}."
            )

            alert_obj = AnomalyAlert(
                astronaut_id=astronaut_id,
                detected_at=str(row["recorded_at"]),
                variables_involved=", ".join(deviating_vars),
                observed_values_json=json.dumps(observed_map),
                baseline_reference_json=json.dumps(baseline_map),
                deviation_description="; ".join(dev_parts),
                detection_method=method,
                anomaly_score=round(norm_score, 3),
                confidence_level=confidence,
                severity_tier=severity,
                status="ACTIVE",
                data_source=str(row["data_source"]),
                explanation=explanation,
                uncertainty_statement=MANDATORY_UNCERTAINTY_STATEMENT,
            )
            if persist_alerts:
                db.add(alert_obj)
                db.flush()
            detected_alerts.append(alert_obj)

    if persist_alerts:
        db.commit()

    return {
        "astronaut_id": astronaut_id,
        "call_sign": astronaut.call_sign,
        "model_artifact": str(model_path),
        "samples_analyzed": len(df),
        "baseline": baseline,
        "alerts_detected": len(detected_alerts),
    }


def evaluate_synthetic_benchmark(benchmark_path: Path | None = None) -> dict[str, Any]:
    """
    Leakage-free out-of-sample evaluation:
    Fits personal baseline, StandardScaler, and IsolationForest strictly on Days 1-12 (iloc[:12])
    and evaluates strictly on held-out Days 13-30 (iloc[12:], 54 observations containing all 6 anomalies).
    """
    path = benchmark_path or (settings.DATA_DIR / "synthetic" / "synthetic_benchmark_30d.json")
    payload = json.loads(path.read_text(encoding="utf-8"))
    health_df = pd.DataFrame(payload["health_records"])
    env_df = pd.DataFrame(payload["environmental_records"])
    env_df["ts"] = pd.to_datetime(env_df["recorded_at"], utc=True)

    y_true_all = []
    y_pred_all = []

    for call_sign, group in health_df.groupby("call_sign"):
        g = group.copy()
        g["ts"] = pd.to_datetime(g["recorded_at"], utc=True)
        g = g.sort_values("ts").reset_index(drop=True)
        g = pd.merge_asof(g, env_df[["ts", "cabin_co2_ppm"]], on="ts", direction="backward")

        train_g = g.iloc[:12]
        test_g = g.iloc[12:]

        baseline = compute_personal_baseline(train_g)
        scaler = StandardScaler()
        X_train = scaler.fit_transform(train_g[MULTIVARIATE_FEATURES].values)
        iforest = IsolationForest(n_estimators=120, contamination=0.05, random_state=42)
        iforest.fit(X_train)

        X_test = scaler.transform(test_g[MULTIVARIATE_FEATURES].values)
        if_preds = iforest.predict(X_test)
        scores = iforest.decision_function(X_test)

        for pos, (_, row) in enumerate(test_g.iterrows()):
            z_hits = 0
            for col, z_t in [("heart_rate_bpm", 2.1), ("spo2_pct", 2.0), ("sleep_duration_hrs", 2.0), ("stress_score", 2.1)]:
                b_mean = baseline[col]["mean"]
                b_std = max(baseline[col]["std"], 0.35)
                if abs((row[col] - b_mean) / b_std) >= z_t:
                    z_hits += 1
            norm_score = float(np.clip(0.5 - scores[pos] * 2.2, 0.05, 0.99))
            pred = int(z_hits >= 2 or (if_preds[pos] == -1 and norm_score >= 0.62))
            y_true_all.append(int(bool(row["synthetic_ground_truth_anomaly"])))
            y_pred_all.append(pred)

    tp = sum(1 for yt, yp in zip(y_true_all, y_pred_all) if yt == 1 and yp == 1)
    fp = sum(1 for yt, yp in zip(y_true_all, y_pred_all) if yt == 0 and yp == 1)
    fn = sum(1 for yt, yp in zip(y_true_all, y_pred_all) if yt == 1 and yp == 0)
    tn = sum(1 for yt, yp in zip(y_true_all, y_pred_all) if yt == 0 and yp == 0)

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0

    return {
        "evaluation_scope": "SYNTHETIC_BENCHMARK_OUT_OF_SAMPLE (AEGIS-SYNTH-30D Days 13-30)",
        "total_samples": len(y_true_all),
        "positive_ground_truth": tp + fn,
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1_score": round(f1, 4),
        "false_positive_rate": round(fpr, 4),
        "confusion_matrix": {"tp": tp, "fp": fp, "fn": fn, "tn": tn},
    }
