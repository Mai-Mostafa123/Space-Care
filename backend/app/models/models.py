from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from app.database.session import Base


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class Astronaut(Base):
    __tablename__ = "astronauts"

    id = Column(Integer, primary_key=True, index=True)
    call_sign = Column(String(32), unique=True, nullable=False, index=True)
    full_name = Column(String(120), nullable=False)
    role = Column(String(80), nullable=False)
    mission_name = Column(String(80), nullable=False)
    age_group = Column(String(32), default="30-45")
    blood_type = Column(String(12), default="Unknown")
    mission_day = Column(Integer, default=1)
    mission_duration_days = Column(Integer, default=180)
    avatar_url = Column(String(255), default="")
    notes = Column(Text, default="")
    data_source = Column(String(20), nullable=False, default="MANUAL")
    created_at = Column(String(40), nullable=False, default=utc_now_iso)
    updated_at = Column(String(40), nullable=False, default=utc_now_iso)

    health_records = relationship("HealthRecord", back_populates="astronaut", cascade="all, delete-orphan")
    sleep_records = relationship("SleepRecord", back_populates="astronaut", cascade="all, delete-orphan")
    activity_records = relationship("ActivityRecord", back_populates="astronaut", cascade="all, delete-orphan")
    mood_logs = relationship("MoodLog", back_populates="astronaut", cascade="all, delete-orphan")
    anomalies = relationship("AnomalyAlert", back_populates="astronaut", cascade="all, delete-orphan")
    history = relationship("ProfileHistory", back_populates="astronaut", cascade="all, delete-orphan")


class ProfileHistory(Base):
    __tablename__ = "profile_history"

    id = Column(Integer, primary_key=True, index=True)
    astronaut_id = Column(Integer, ForeignKey("astronauts.id", ondelete="CASCADE"), nullable=False, index=True)
    field_changed = Column(String(64), nullable=False)
    previous_value = Column(Text, default="")
    new_value = Column(Text, default="")
    change_source = Column(String(32), nullable=False, default="MANUAL_FORM")
    changed_at = Column(String(40), nullable=False, default=utc_now_iso)

    astronaut = relationship("Astronaut", back_populates="history")


class HealthRecord(Base):
    __tablename__ = "health_records"
    __table_args__ = (
        Index("ix_health_astronaut_time", "astronaut_id", "recorded_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    astronaut_id = Column(Integer, ForeignKey("astronauts.id", ondelete="CASCADE"), nullable=False)
    recorded_at = Column(String(40), nullable=False, index=True)
    heart_rate_bpm = Column(Float, nullable=True)
    spo2_pct = Column(Float, nullable=True)
    sleep_duration_hrs = Column(Float, nullable=True)
    sleep_quality_score = Column(Float, nullable=True)
    deep_sleep_hrs = Column(Float, nullable=True)
    rem_sleep_hrs = Column(Float, nullable=True)
    activity_minutes = Column(Integer, nullable=True)
    exercise_type = Column(String(80), default="Scheduled Exercise")
    stress_score = Column(Float, nullable=True)
    mood_score = Column(Float, nullable=True)
    mood_notes = Column(Text, default="")
    data_source = Column(String(20), nullable=False, default="MANUAL")
    is_cleaned = Column(Boolean, default=True)
    missing_imputed = Column(Boolean, default=False)
    created_at = Column(String(40), nullable=False, default=utc_now_iso)

    astronaut = relationship("Astronaut", back_populates="health_records")


class EnvironmentalRecord(Base):
    __tablename__ = "environmental_records"
    __table_args__ = (
        Index("ix_env_mission_time", "mission_name", "recorded_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    mission_name = Column(String(80), nullable=False)
    habitat_zone = Column(String(80), nullable=False, default="Crew Quarters")
    recorded_at = Column(String(40), nullable=False, index=True)
    radiation_msv_day = Column(Float, nullable=False)
    cabin_co2_ppm = Column(Float, nullable=False)
    oxygen_pct = Column(Float, nullable=False)
    temperature_c = Column(Float, nullable=False)
    humidity_pct = Column(Float, nullable=False)
    pressure_kpa = Column(Float, nullable=False)
    data_source = Column(String(20), nullable=False, default="MANUAL")
    created_at = Column(String(40), nullable=False, default=utc_now_iso)


class SleepRecord(Base):
    __tablename__ = "sleep_records"

    id = Column(Integer, primary_key=True, index=True)
    astronaut_id = Column(Integer, ForeignKey("astronauts.id", ondelete="CASCADE"), nullable=False, index=True)
    sleep_start = Column(String(40), nullable=False)
    sleep_end = Column(String(40), nullable=False)
    duration_hrs = Column(Float, nullable=False)
    deep_hrs = Column(Float, default=0.0)
    rem_hrs = Column(Float, default=0.0)
    light_hrs = Column(Float, default=0.0)
    wake_events = Column(Integer, default=0)
    quality_index = Column(Float, default=75.0)
    data_source = Column(String(20), nullable=False, default="MANUAL")
    created_at = Column(String(40), nullable=False, default=utc_now_iso)

    astronaut = relationship("Astronaut", back_populates="sleep_records")


class ActivityRecord(Base):
    __tablename__ = "activity_records"

    id = Column(Integer, primary_key=True, index=True)
    astronaut_id = Column(Integer, ForeignKey("astronauts.id", ondelete="CASCADE"), nullable=False, index=True)
    recorded_at = Column(String(40), nullable=False)
    activity_type = Column(String(80), nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    intensity_level = Column(String(32), default="Moderate")
    estimated_kcal = Column(Integer, default=0)
    resistive_load_kg = Column(Float, default=0.0)
    data_source = Column(String(20), nullable=False, default="MANUAL")
    created_at = Column(String(40), nullable=False, default=utc_now_iso)

    astronaut = relationship("Astronaut", back_populates="activity_records")


class MoodLog(Base):
    __tablename__ = "mood_logs"

    id = Column(Integer, primary_key=True, index=True)
    astronaut_id = Column(Integer, ForeignKey("astronauts.id", ondelete="CASCADE"), nullable=False, index=True)
    logged_at = Column(String(40), nullable=False)
    mood_rating = Column(Float, nullable=False)
    stress_rating = Column(Float, nullable=False)
    workload_rating = Column(Float, default=5.0)
    sleep_rested_rating = Column(Float, default=7.0)
    journal_note = Column(Text, default="")
    entry_method = Column(String(32), default="MANUAL_FORM")
    data_source = Column(String(20), nullable=False, default="MANUAL")
    created_at = Column(String(40), nullable=False, default=utc_now_iso)

    astronaut = relationship("Astronaut", back_populates="mood_logs")


class AnomalyAlert(Base):
    __tablename__ = "anomaly_alerts"

    id = Column(Integer, primary_key=True, index=True)
    astronaut_id = Column(Integer, ForeignKey("astronauts.id", ondelete="CASCADE"), nullable=False, index=True)
    detected_at = Column(String(40), nullable=False, index=True)
    variables_involved = Column(String(255), nullable=False)
    observed_values_json = Column(Text, nullable=False)
    baseline_reference_json = Column(Text, nullable=False)
    deviation_description = Column(Text, nullable=False)
    detection_method = Column(String(64), nullable=False)
    anomaly_score = Column(Float, nullable=False)
    confidence_level = Column(String(20), nullable=False)
    severity_tier = Column(String(32), nullable=False)
    status = Column(String(20), nullable=False, default="ACTIVE")
    data_source = Column(String(20), nullable=False, default="SYNTHETIC")
    explanation = Column(Text, nullable=False)
    uncertainty_statement = Column(Text, nullable=False)
    acknowledged_at = Column(String(40), nullable=True)

    astronaut = relationship("Astronaut", back_populates="anomalies")


class DatasetEntry(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)
    dataset_identifier = Column(String(64), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    original_source = Column(String(200), nullable=False)
    source_classification = Column(String(20), nullable=False)  # REAL | SIMULATED | MANUAL
    variables_json = Column(Text, nullable=False)
    file_format = Column(String(120), nullable=False)
    record_count = Column(String(120), nullable=False)
    subject_count = Column(Integer, nullable=True)
    time_coverage = Column(String(120), nullable=False)
    accessibility = Column(String(200), nullable=False)
    download_or_api_method = Column(String(255), nullable=False)
    license_info = Column(String(200), nullable=False)
    relevance_notes = Column(Text, nullable=False)
    limitations = Column(Text, nullable=False)
    created_at = Column(String(40), nullable=False, default=utc_now_iso)


class ResearchDocument(Base):
    __tablename__ = "research_documents"

    id = Column(Integer, primary_key=True, index=True)
    doc_id = Column(String(64), unique=True, nullable=False, index=True)
    title = Column(String(255), nullable=False)
    source_org = Column(String(180), nullable=False)
    publication_year = Column(Integer, nullable=False)
    url = Column(String(255), nullable=False)
    hazard_category = Column(String(80), nullable=False)
    abstract = Column(Text, nullable=False)
    content_chunks_json = Column(Text, nullable=False)
    verified_reference = Column(String(255), nullable=False)


class AssistantConversation(Base):
    __tablename__ = "assistant_conversations"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(64), nullable=False, index=True)
    astronaut_id = Column(Integer, ForeignKey("astronauts.id", ondelete="SET NULL"), nullable=True)
    role = Column(String(20), nullable=False)  # user | assistant
    message_text = Column(Text, nullable=False)
    citations_json = Column(Text, default="[]")
    context_records_json = Column(Text, default="[]")
    inference_engine = Column(String(80), default="Ollama Local")
    uncertainty_note = Column(Text, default="")
    created_at = Column(String(40), nullable=False, default=utc_now_iso)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(64), nullable=False)
    entity_type = Column(String(64), nullable=False)
    entity_id = Column(String(64), default="")
    action = Column(String(64), nullable=False)
    actor = Column(String(64), default="LOCAL_OPERATOR")
    details_json = Column(Text, default="{}")
    created_at = Column(String(40), nullable=False, default=utc_now_iso)
