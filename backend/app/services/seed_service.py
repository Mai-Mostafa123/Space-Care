import json
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.models import (
    Astronaut,
    AuditLog,
    DatasetEntry,
    EnvironmentalRecord,
    HealthRecord,
    MoodLog,
    ResearchDocument,
    SleepRecord,
    ActivityRecord,
)


def seed_initial_data(db: Session) -> dict[str, int]:
    """
    Idempotently seeds:
    1. Verified NASA Dataset Registry (REAL + SIMULATED + MANUAL metadata)
    2. Verified NASA Research Corpus for local RAG
    3. Explicitly labeled SYNTHETIC 30-day crew & habitat benchmark
    """
    counts = {"datasets": 0, "documents": 0, "astronauts": 0, "health": 0, "environment": 0}

    registry_path = settings.DATA_DIR / "metadata" / "dataset_registry.json"
    if registry_path.exists() and db.query(DatasetEntry).count() == 0:
        entries = json.loads(registry_path.read_text(encoding="utf-8"))
        for item in entries:
            db.add(
                DatasetEntry(
                    dataset_identifier=item["dataset_identifier"],
                    name=item["name"],
                    original_source=item["original_source"],
                    source_classification=item["source_classification"],
                    variables_json=json.dumps(item["variables"]),
                    file_format=item["file_format"],
                    record_count=str(item["record_count"]),
                    subject_count=item.get("subject_count"),
                    time_coverage=item["time_coverage"],
                    accessibility=item["accessibility"],
                    download_or_api_method=item["download_or_api_method"],
                    license_info=item["license_info"],
                    relevance_notes=item["relevance_notes"],
                    limitations=item["limitations"],
                )
            )
            counts["datasets"] += 1

    corpus_path = settings.DATA_DIR / "metadata" / "nasa_research_corpus.json"
    if corpus_path.exists() and db.query(ResearchDocument).count() == 0:
        docs = json.loads(corpus_path.read_text(encoding="utf-8"))
        for doc in docs:
            db.add(
                ResearchDocument(
                    doc_id=doc["doc_id"],
                    title=doc["title"],
                    source_org=doc["source_org"],
                    publication_year=doc["publication_year"],
                    url=doc["url"],
                    hazard_category=doc["hazard_category"],
                    abstract=doc["abstract"],
                    content_chunks_json=json.dumps(doc["chunks"]),
                    verified_reference=doc["verified_reference"],
                )
            )
            counts["documents"] += 1

    synth_path = settings.DATA_DIR / "synthetic" / "synthetic_benchmark_30d.json"
    if synth_path.exists() and db.query(Astronaut).count() == 0:
        payload = json.loads(synth_path.read_text(encoding="utf-8"))
        call_sign_map: dict[str, int] = {}

        for c in payload["astronauts"]:
            astro = Astronaut(
                call_sign=c["call_sign"],
                full_name=c["full_name"],
                role=c["role"],
                mission_name=c["mission_name"],
                age_group=c["age_group"],
                blood_type=c["blood_type"],
                mission_day=c["mission_day"],
                mission_duration_days=c["mission_duration_days"],
                avatar_url=c.get("avatar_url", ""),
                notes=c["notes"],
                data_source="SYNTHETIC",
            )
            db.add(astro)
            db.flush()
            call_sign_map[c["call_sign"]] = astro.id
            counts["astronauts"] += 1

        for env in payload["environmental_records"]:
            db.add(
                EnvironmentalRecord(
                    mission_name=env["mission_name"],
                    habitat_zone=env["habitat_zone"],
                    recorded_at=env["recorded_at"],
                    radiation_msv_day=env["radiation_msv_day"],
                    cabin_co2_ppm=env["cabin_co2_ppm"],
                    oxygen_pct=env["oxygen_pct"],
                    temperature_c=env["temperature_c"],
                    humidity_pct=env["humidity_pct"],
                    pressure_kpa=env["pressure_kpa"],
                    data_source="SYNTHETIC",
                )
            )
            counts["environment"] += 1

        for h in payload["health_records"]:
            aid = call_sign_map[h["call_sign"]]
            db.add(
                HealthRecord(
                    astronaut_id=aid,
                    recorded_at=h["recorded_at"],
                    heart_rate_bpm=h["heart_rate_bpm"],
                    spo2_pct=h["spo2_pct"],
                    sleep_duration_hrs=h["sleep_duration_hrs"],
                    sleep_quality_score=h["sleep_quality_score"],
                    deep_sleep_hrs=h["deep_sleep_hrs"],
                    rem_sleep_hrs=h["rem_sleep_hrs"],
                    activity_minutes=h["activity_minutes"],
                    exercise_type=h["exercise_type"],
                    stress_score=h["stress_score"],
                    mood_score=h["mood_score"],
                    mood_notes=h["mood_notes"],
                    data_source="SYNTHETIC",
                    is_cleaned=True,
                    missing_imputed=False,
                )
            )
            db.add(
                SleepRecord(
                    astronaut_id=aid,
                    sleep_start=h["recorded_at"],
                    sleep_end=h["recorded_at"],
                    duration_hrs=h["sleep_duration_hrs"],
                    deep_hrs=h["deep_sleep_hrs"],
                    rem_hrs=h["rem_sleep_hrs"],
                    light_hrs=round(max(0.0, h["sleep_duration_hrs"] - h["deep_sleep_hrs"] - h["rem_sleep_hrs"]), 2),
                    wake_events=2 if h["sleep_duration_hrs"] < 5.5 else 0,
                    quality_index=h["sleep_quality_score"],
                    data_source="SYNTHETIC",
                )
            )
            db.add(
                ActivityRecord(
                    astronaut_id=aid,
                    recorded_at=h["recorded_at"],
                    activity_type=h["exercise_type"],
                    duration_minutes=h["activity_minutes"],
                    intensity_level="High" if h["activity_minutes"] >= 120 else "Moderate",
                    estimated_kcal=int(h["activity_minutes"] * 6.2),
                    data_source="SYNTHETIC",
                )
            )
            db.add(
                MoodLog(
                    astronaut_id=aid,
                    logged_at=h["recorded_at"],
                    mood_rating=h["mood_score"],
                    stress_rating=h["stress_score"],
                    journal_note=h["mood_notes"],
                    entry_method="SYNTHETIC_BENCHMARK",
                    data_source="SYNTHETIC",
                )
            )
            counts["health"] += 1

        db.add(
            AuditLog(
                event_type="SEED_INIT",
                entity_type="SYSTEM",
                action="INITIALIZE_SYNTHETIC_AND_NASA_REGISTRY",
                details_json=json.dumps(counts),
            )
        )

    db.commit()
    return counts
