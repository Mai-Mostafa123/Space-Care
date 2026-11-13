"""
Local Voice Processing & Structured Information Extraction
Flow: Voice Audio -> Local Whisper/Vosk STT -> Structured JSON -> Pydantic Validation -> User Review -> SQLite
Never silently saves uncertain extracted fields.
"""

import re
import tempfile
from pathlib import Path
from typing import Any
from pydantic import ValidationError

from app.core.config import settings
from app.schemas.schemas import HealthRecordCreate

_WHISPER_MODEL = None


def transcribe_local_audio(audio_bytes: bytes, filename: str = "audio.webm") -> dict[str, Any]:
    """
    Attempts local offline speech-to-text via faster-whisper (CPU int8).
    Returns explicit availability status if model weights or runtime dependencies are missing.
    """
    global _WHISPER_MODEL
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        return {
            "success": False,
            "transcript": "",
            "engine": "unavailable",
            "error": "faster-whisper is not installed. Install backend/requirements.txt or use browser speech transcript input.",
        }

    suffix = Path(filename).suffix or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as tmp:
        tmp.write(audio_bytes)
        tmp.flush()
        try:
            if _WHISPER_MODEL is None:
                _WHISPER_MODEL = WhisperModel(
                    settings.WHISPER_MODEL_SIZE,
                    device=settings.WHISPER_DEVICE,
                    compute_type=settings.WHISPER_COMPUTE_TYPE,
                )
            segments, info = _WHISPER_MODEL.transcribe(tmp.name, beam_size=3, vad_filter=True)
            transcript = " ".join(seg.text.strip() for seg in segments).strip()
            return {
                "success": True,
                "transcript": transcript,
                "language": info.language,
                "engine": f"faster-whisper ({settings.WHISPER_MODEL_SIZE}, {settings.WHISPER_COMPUTE_TYPE})",
                "error": None,
            }
        except Exception as exc:
            return {
                "success": False,
                "transcript": "",
                "engine": "faster-whisper",
                "error": f"Local transcription failed: {exc}",
            }


def extract_structured_from_transcript(
    transcript: str,
    target_mode: str = "health_log",
    astronaut_id: int | None = None,
) -> dict[str, Any]:
    """
    Deterministic, auditable regex/NLP extractor converting transcribed crew speech
    into editable JSON fields with explicit uncertainty flags.
    """
    text = transcript.strip()
    lower = text.lower()
    extracted: dict[str, Any] = {}
    uncertain: list[str] = []
    errors: list[str] = []

    if len(text) < 4:
        errors.append("Transcript too short to extract structured fields reliably.")

    if target_mode == "health_log":
        hr_match = re.search(r"(?:heart\s*rate|hr|pulse)\s*(?:is|at|was|of|:)?\s*(\d{2,3}(?:\.\d+)?)", lower)
        spo2_match = re.search(r"(?:spo2|oxygen|o2\s*sat(?:uration)?)\s*(?:is|at|was|of|:)?\s*(\d{2,3}(?:\.\d+)?)", lower)
        sleep_match = re.search(r"(?:slept|sleep(?:\s*duration)?)\s*(?:for|was|is|of|:)?\s*(\d{1,2}(?:\.\d+)?)\s*(?:hours?|hrs?|h)?", lower)
        stress_match = re.search(r"(?:stress)\s*(?:level|score|is|at|was|of|:)?\s*(\d{1,2}(?:\.\d+)?)", lower)
        mood_match = re.search(r"(?:mood)\s*(?:level|score|is|at|was|of|:)?\s*(\d{1,2}(?:\.\d+)?)", lower)
        act_match = re.search(r"(?:exercise|exercised|activity|workout)\s*(?:for|was|of|:)?\s*(\d{1,3})\s*(?:minutes?|mins?|m)?", lower)

        if hr_match:
            val = float(hr_match.group(1))
            extracted["heart_rate_bpm"] = val
            if val < 35 or val > 200:
                uncertain.append("heart_rate_bpm (outside typical resting/exercise bounds — verify)")
        else:
            uncertain.append("heart_rate_bpm (not detected in transcript)")

        if spo2_match:
            val = float(spo2_match.group(1))
            extracted["spo2_pct"] = val
            if val < 80 or val > 100:
                uncertain.append("spo2_pct (unusual saturation value — verify)")
        else:
            uncertain.append("spo2_pct (not detected in transcript)")

        if sleep_match:
            extracted["sleep_duration_hrs"] = float(sleep_match.group(1))
        if stress_match:
            extracted["stress_score"] = min(10.0, max(1.0, float(stress_match.group(1))))
        if mood_match:
            extracted["mood_score"] = min(10.0, max(1.0, float(mood_match.group(1))))
        if act_match:
            extracted["activity_minutes"] = int(act_match.group(1))

        extracted["mood_notes"] = text
        extracted["data_source"] = "MANUAL"

        validation_passed = False
        try:
            HealthRecordCreate(astronaut_id=astronaut_id or 1, **extracted)
            validation_passed = True
        except ValidationError as ve:
            errors.extend([f"{e['loc'][0]}: {e['msg']}" for e in ve.errors()])

        return {
            "transcript": text,
            "target_mode": target_mode,
            "extracted_fields": extracted,
            "uncertain_fields": uncertain,
            "transcription_errors": errors,
            "requires_confirmation": True,
            "validation_passed": validation_passed and len(errors) == 0,
        }

    # Profile update mode
    role_match = re.search(r"(?:role|position)\s*(?:is|as|to|:)?\s*([a-zA-Z\s]{3,40}?)(?:\.|,|mission|$)", text, re.I)
    mission_match = re.search(r"(?:mission)\s*(?:is|name|:)?\s*([A-Z0-9\-]{3,24})", text)
    day_match = re.search(r"mission\s*day\s*(\d{1,4})", lower)

    if role_match:
        extracted["role"] = role_match.group(1).strip()
    else:
        uncertain.append("role")
    if mission_match:
        extracted["mission_name"] = mission_match.group(1).strip()
    if day_match:
        extracted["mission_day"] = int(day_match.group(1))
    extracted["notes"] = text

    return {
        "transcript": text,
        "target_mode": target_mode,
        "extracted_fields": extracted,
        "uncertain_fields": uncertain,
        "transcription_errors": errors,
        "requires_confirmation": True,
        "validation_passed": len(errors) == 0,
    }
