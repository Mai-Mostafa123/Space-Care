import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.session import get_db
from app.models.models import (
    AnomalyAlert,
    Astronaut,
    DatasetEntry,
    EnvironmentalRecord,
    HealthRecord,
    ResearchDocument,
    utc_now_iso,
)
from rag.rag_pipeline import check_ollama_status

reports_router = APIRouter(prefix="/api/reports", tags=["Daily Reports"])
datasets_router = APIRouter(prefix="/api/datasets", tags=["Datasets & Research"])
system_router = APIRouter(prefix="/api/system", tags=["System"])


@reports_router.get("/daily")
def generate_daily_report(astronaut_id: int | None = None, db: Session = Depends(get_db)):
    astronauts = (
        db.query(Astronaut).filter(Astronaut.id == astronaut_id).all()
        if astronaut_id
        else db.query(Astronaut).order_by(Astronaut.id.asc()).all()
    )
    latest_env = db.query(EnvironmentalRecord).order_by(EnvironmentalRecord.recorded_at.desc()).first()
    active_alerts = db.query(AnomalyAlert).filter(AnomalyAlert.status == "ACTIVE").all()

    crew_summaries = []
    source_set = set()
    for astro in astronauts:
        source_set.add(astro.data_source)
        recs = (
            db.query(HealthRecord)
            .filter(HealthRecord.astronaut_id == astro.id)
            .order_by(HealthRecord.recorded_at.desc())
            .limit(7)
            .all()
        )
        for r in recs:
            source_set.add(r.data_source)
        if recs:
            avg_hr = round(sum(r.heart_rate_bpm or 0 for r in recs) / len(recs), 1)
            avg_spo2 = round(sum(r.spo2_pct or 0 for r in recs) / len(recs), 2)
            avg_sleep = round(sum(r.sleep_duration_hrs or 0 for r in recs) / len(recs), 2)
            latest = recs[0]
            crew_summaries.append(
                {
                    "astronaut_id": astro.id,
                    "call_sign": astro.call_sign,
                    "full_name": astro.full_name,
                    "data_source": astro.data_source,
                    "latest_recorded_at": latest.recorded_at,
                    "latest_hr_bpm": latest.heart_rate_bpm,
                    "latest_spo2_pct": latest.spo2_pct,
                    "latest_sleep_hrs": latest.sleep_duration_hrs,
                    "seven_day_avg_hr": avg_hr,
                    "seven_day_avg_spo2": avg_spo2,
                    "seven_day_avg_sleep": avg_sleep,
                }
            )

    return {
        "generated_at": utc_now_iso(),
        "report_type": "DAILY_CREW_AND_HABITAT_SUMMARY",
        "data_sources_present": sorted(source_set),
        "non_diagnostic_disclaimer": (
            "Operational decision-support summary only. Synthetic records are explicitly labeled SYNTHETIC "
            "and do not represent clinical diagnoses or real astronaut flight records."
        ),
        "crew_summaries": crew_summaries,
        "environmental_summary": (
            {
                "recorded_at": latest_env.recorded_at,
                "mission_name": latest_env.mission_name,
                "radiation_msv_day": latest_env.radiation_msv_day,
                "cabin_co2_ppm": latest_env.cabin_co2_ppm,
                "oxygen_pct": latest_env.oxygen_pct,
                "temperature_c": latest_env.temperature_c,
                "humidity_pct": latest_env.humidity_pct,
                "pressure_kpa": latest_env.pressure_kpa,
                "data_source": latest_env.data_source,
            }
            if latest_env
            else None
        ),
        "active_anomalies_count": len(active_alerts),
        "active_anomalies": [
            {
                "id": a.id,
                "astronaut_id": a.astronaut_id,
                "severity_tier": a.severity_tier,
                "variables_involved": a.variables_involved,
                "explanation": a.explanation,
                "data_source": a.data_source,
            }
            for a in active_alerts
        ],
    }


@datasets_router.get("")
def list_datasets(db: Session = Depends(get_db)):
    entries = db.query(DatasetEntry).order_by(DatasetEntry.id.asc()).all()
    docs = db.query(ResearchDocument).order_by(ResearchDocument.id.asc()).all()
    return {
        "datasets": [
            {
                "id": d.id,
                "dataset_identifier": d.dataset_identifier,
                "name": d.name,
                "original_source": d.original_source,
                "source_classification": d.source_classification,
                "variables": json.loads(d.variables_json),
                "file_format": d.file_format,
                "record_count": d.record_count,
                "subject_count": d.subject_count,
                "time_coverage": d.time_coverage,
                "accessibility": d.accessibility,
                "download_or_api_method": d.download_or_api_method,
                "license_info": d.license_info,
                "relevance_notes": d.relevance_notes,
                "limitations": d.limitations,
            }
            for d in entries
        ],
        "research_documents": [
            {
                "doc_id": r.doc_id,
                "title": r.title,
                "source_org": r.source_org,
                "publication_year": r.publication_year,
                "url": r.url,
                "hazard_category": r.hazard_category,
                "abstract": r.abstract,
                "verified_reference": r.verified_reference,
            }
            for r in docs
        ],
    }


@system_router.get("/status")
def system_status(db: Session = Depends(get_db)):
    ollama = check_ollama_status()
    return {
        "runtime_mode": "FASTAPI_PRODUCTION_LOCAL",
        "api_version": settings.APP_VERSION,
        "database_connected": True,
        "database_path": str(settings.SQLITE_DB_PATH),
        "offline_ready": True,
        "ollama": ollama,
        "counts": {
            "astronauts": db.query(Astronaut).count(),
            "health_records": db.query(HealthRecord).count(),
            "environmental_records": db.query(EnvironmentalRecord).count(),
            "active_anomalies": db.query(AnomalyAlert).filter(AnomalyAlert.status == "ACTIVE").count(),
            "datasets": db.query(DatasetEntry).count(),
            "research_documents": db.query(ResearchDocument).count(),
        },
    }
