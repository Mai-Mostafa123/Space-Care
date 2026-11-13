from typing import Any, Literal, Optional
from pydantic import BaseModel, Field, field_validator

DataSourceType = Literal["REAL", "SYNTHETIC", "MANUAL"]


class AstronautBase(BaseModel):
    call_sign: str = Field(..., min_length=2, max_length=32)
    full_name: str = Field(..., min_length=2, max_length=120)
    role: str = Field(..., min_length=2, max_length=80)
    mission_name: str = Field(..., min_length=2, max_length=80)
    age_group: str = Field(default="30-45", max_length=32)
    blood_type: str = Field(default="Unknown", max_length=12)
    mission_day: int = Field(default=1, ge=0, le=2000)
    mission_duration_days: int = Field(default=180, ge=1, le=2000)
    avatar_url: str = Field(default="", max_length=255)
    notes: str = Field(default="", max_length=2000)
    data_source: DataSourceType = "MANUAL"


class AstronautCreate(AstronautBase):
    change_source: str = Field(default="MANUAL_FORM", max_length=32)


class AstronautUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    role: Optional[str] = Field(default=None, min_length=2, max_length=80)
    mission_name: Optional[str] = Field(default=None, min_length=2, max_length=80)
    age_group: Optional[str] = Field(default=None, max_length=32)
    blood_type: Optional[str] = Field(default=None, max_length=12)
    mission_day: Optional[int] = Field(default=None, ge=0, le=2000)
    mission_duration_days: Optional[int] = Field(default=None, ge=1, le=2000)
    notes: Optional[str] = Field(default=None, max_length=2000)
    change_source: str = Field(default="MANUAL_FORM", max_length=32)


class AstronautOut(AstronautBase):
    id: int
    created_at: str
    updated_at: str
    model_config = {"from_attributes": True}


class HealthRecordCreate(BaseModel):
    astronaut_id: int = Field(..., ge=1)
    recorded_at: Optional[str] = None
    heart_rate_bpm: Optional[float] = Field(default=None, ge=30.0, le=220.0)
    spo2_pct: Optional[float] = Field(default=None, ge=70.0, le=100.0)
    sleep_duration_hrs: Optional[float] = Field(default=None, ge=0.0, le=24.0)
    sleep_quality_score: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    deep_sleep_hrs: Optional[float] = Field(default=None, ge=0.0, le=16.0)
    rem_sleep_hrs: Optional[float] = Field(default=None, ge=0.0, le=16.0)
    activity_minutes: Optional[int] = Field(default=None, ge=0, le=1440)
    exercise_type: str = Field(default="Scheduled Exercise", max_length=80)
    stress_score: Optional[float] = Field(default=None, ge=1.0, le=10.0)
    mood_score: Optional[float] = Field(default=None, ge=1.0, le=10.0)
    mood_notes: str = Field(default="", max_length=1000)
    data_source: DataSourceType = "MANUAL"

    @field_validator("heart_rate_bpm", "spo2_pct", "sleep_duration_hrs", "stress_score", "mood_score")
    @classmethod
    def round_telemetry(cls, v: Optional[float]) -> Optional[float]:
        return round(v, 2) if v is not None else None


class EnvironmentalRecordCreate(BaseModel):
    mission_name: str = Field(default="ARTEMIS-SIM-04", max_length=80)
    habitat_zone: str = Field(default="Crew Quarters & Medical Bay", max_length=80)
    recorded_at: Optional[str] = None
    radiation_msv_day: float = Field(..., ge=0.0, le=500.0)
    cabin_co2_ppm: float = Field(..., ge=100.0, le=50000.0)
    oxygen_pct: float = Field(..., ge=10.0, le=40.0)
    temperature_c: float = Field(..., ge=0.0, le=50.0)
    humidity_pct: float = Field(..., ge=5.0, le=99.0)
    pressure_kpa: float = Field(..., ge=30.0, le=130.0)
    data_source: DataSourceType = "MANUAL"


class VoiceExtractRequest(BaseModel):
    transcript: str = Field(..., min_length=3, max_length=3000)
    target_mode: Literal["health_log", "profile_update"] = "health_log"
    astronaut_id: Optional[int] = None


class VoiceExtractedResult(BaseModel):
    transcript: str
    target_mode: str
    extracted_fields: dict[str, Any]
    uncertain_fields: list[str]
    transcription_errors: list[str]
    requires_confirmation: bool = True
    validation_passed: bool


class AssistantQueryRequest(BaseModel):
    question: str = Field(..., min_length=2, max_length=2000)
    astronaut_id: Optional[int] = None
    session_id: str = Field(default="default-local-session", max_length=64)
    model_name: Optional[str] = None


class AnomalyStatusUpdate(BaseModel):
    status: Literal["ACTIVE", "ACKNOWLEDGED", "RESOLVED"]
