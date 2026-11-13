from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.models import Astronaut, EnvironmentalRecord, HealthRecord, MoodLog, SleepRecord, ActivityRecord
from app.schemas.schemas import EnvironmentalRecordCreate, HealthRecordCreate
from app.services.data_pipeline import clean_and_impute_health_payload, normalize_timestamp

health_router = APIRouter(prefix="/api/health", tags=["Health Telemetry"])
env_router = APIRouter(prefix="/api/environment", tags=["Environmental Telemetry"])


@health_router.get("")
def list_health_records(
    astronaut_id: Optional[int] = Query(default=None),
    data_source: Optional[str] = Query(default=None),
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
):
    q = db.query(HealthRecord)
    if astronaut_id is not None:
        q = q.filter(HealthRecord.astronaut_id == astronaut_id)
    if data_source and data_source != "ALL":
        q = q.filter(HealthRecord.data_source == data_source)
    rows = q.order_by(HealthRecord.recorded_at.asc()).all()
    if len(rows) > days * 4:
        rows = rows[-(days * 4) :]
    return [
        {
            "id": r.id,
            "astronaut_id": r.astronaut_id,
            "recorded_at": r.recorded_at,
            "heart_rate_bpm": r.heart_rate_bpm,
            "spo2_pct": r.spo2_pct,
            "sleep_duration_hrs": r.sleep_duration_hrs,
            "sleep_quality_score": r.sleep_quality_score,
            "deep_sleep_hrs": r.deep_sleep_hrs,
            "rem_sleep_hrs": r.rem_sleep_hrs,
            "activity_minutes": r.activity_minutes,
            "exercise_type": r.exercise_type,
            "stress_score": r.stress_score,
            "mood_score": r.mood_score,
            "mood_notes": r.mood_notes,
            "data_source": r.data_source,
            "is_cleaned": r.is_cleaned,
            "missing_imputed": r.missing_imputed,
        }
        for r in rows
    ]


@health_router.post("", status_code=status.HTTP_201_CREATED)
def ingest_health_record(payload: HealthRecordCreate, db: Session = Depends(get_db)):
    astro = db.query(Astronaut).filter(Astronaut.id == payload.astronaut_id).first()
    if not astro:
        raise HTTPException(status_code=404, detail="Target astronaut not found")

    cleaned, imputed = clean_and_impute_health_payload(db, payload.astronaut_id, payload.model_dump())
    rec = HealthRecord(
        **cleaned,
        is_cleaned=True,
        missing_imputed=imputed,
    )
    db.add(rec)

    if cleaned.get("sleep_duration_hrs") is not None:
        db.add(
            SleepRecord(
                astronaut_id=payload.astronaut_id,
                sleep_start=cleaned["recorded_at"],
                sleep_end=cleaned["recorded_at"],
                duration_hrs=cleaned["sleep_duration_hrs"],
                quality_index=cleaned.get("sleep_quality_score") or 75.0,
                data_source=cleaned["data_source"],
            )
        )
    if cleaned.get("activity_minutes") is not None:
        db.add(
            ActivityRecord(
                astronaut_id=payload.astronaut_id,
                recorded_at=cleaned["recorded_at"],
                activity_type=cleaned.get("exercise_type") or "Scheduled Exercise",
                duration_minutes=cleaned["activity_minutes"],
                data_source=cleaned["data_source"],
            )
        )
    if cleaned.get("mood_score") is not None and cleaned.get("stress_score") is not None:
        db.add(
            MoodLog(
                astronaut_id=payload.astronaut_id,
                logged_at=cleaned["recorded_at"],
                mood_rating=cleaned["mood_score"],
                stress_rating=cleaned["stress_score"],
                journal_note=cleaned.get("mood_notes") or "",
                data_source=cleaned["data_source"],
            )
        )

    db.commit()
    db.refresh(rec)
    return {"id": rec.id, "missing_imputed": imputed, "data_source": rec.data_source, "recorded_at": rec.recorded_at}


@env_router.get("")
def list_environment_records(
    mission_name: Optional[str] = Query(default=None),
    data_source: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    q = db.query(EnvironmentalRecord)
    if mission_name:
        q = q.filter(EnvironmentalRecord.mission_name == mission_name)
    if data_source and data_source != "ALL":
        q = q.filter(EnvironmentalRecord.data_source == data_source)
    rows = q.order_by(EnvironmentalRecord.recorded_at.asc()).all()
    return [
        {
            "id": e.id,
            "mission_name": e.mission_name,
            "habitat_zone": e.habitat_zone,
            "recorded_at": e.recorded_at,
            "radiation_msv_day": e.radiation_msv_day,
            "cabin_co2_ppm": e.cabin_co2_ppm,
            "oxygen_pct": e.oxygen_pct,
            "temperature_c": e.temperature_c,
            "humidity_pct": e.humidity_pct,
            "pressure_kpa": e.pressure_kpa,
            "data_source": e.data_source,
        }
        for e in rows
    ]


@env_router.post("", status_code=status.HTTP_201_CREATED)
def ingest_environment_record(payload: EnvironmentalRecordCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    data["recorded_at"] = normalize_timestamp(data.get("recorded_at"))
    rec = EnvironmentalRecord(**data)
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return {"id": rec.id, "recorded_at": rec.recorded_at, "data_source": rec.data_source}
