# Data Dictionary — Aegis Orbital Health

**Database Engine:** SQLite (`aegis_orbital.db`)  
**ORM / Schema Parity:** Python SQLAlchemy (`backend/app/models/models.py`) and Node.js SQLite preview runtime (`server.ts`) share identical table names, column semantics, foreign keys, and provenance tags.

---

## 1. Provenance & Classification Enumeration

| Field / Value | Meaning |
|---|---|
| `REAL` | Verified scientific metadata or approved real-world data imported from official repositories (e.g., NASA OSDR/HRR). |
| `SYNTHETIC` (Dataset class: `SIMULATED`) | Programmatically generated benchmark data for development, ML evaluation, and offline demonstration. Never represents real astronauts. |
| `MANUAL` | Operator-entered via manual forms or explicitly reviewed and confirmed via the Voice-to-Structured-JSON workflow. |

---

## 2. Normalized Tables

### `astronauts`
Stores individual crew profiles (fictional/synthetic or operator-created).
- `id` (INTEGER PK): Internal unique astronaut record ID.
- `call_sign` (TEXT UNIQUE NOT NULL): Mission call sign (e.g., `CDR-01`).
- `full_name` (TEXT NOT NULL): Crew member name (synthetic/fictional in demo data).
- `role` (TEXT NOT NULL): Mission role (e.g., `Mission Commander`, `Biomedical Specialist`).
- `mission_name` (TEXT NOT NULL): Assigned mission identifier (e.g., `ARTEMIS-SIM-04`).
- `age_group` (TEXT): Approved demographic bracket (e.g., `35-44`).
- `blood_type` (TEXT): Approved medical reference code (e.g., `O+`).
- `mission_day` (INTEGER): Current elapsed mission day.
- `mission_duration_days` (INTEGER): Planned mission duration in days.
- `avatar_url` (TEXT): Local static asset path or empty string.
- `notes` (TEXT): Approved operational notes.
- `data_source` (TEXT NOT NULL): `SYNTHETIC` | `MANUAL` | `REAL`.
- `created_at` (TEXT ISO-8601 UTC): Creation timestamp.
- `updated_at` (TEXT ISO-8601 UTC): Last modification timestamp.

### `profile_history`
Immutable audit trail of profile edits.
- `id` (INTEGER PK)
- `astronaut_id` (INTEGER FK -> `astronauts.id` ON DELETE CASCADE)
- `field_changed` (TEXT NOT NULL)
- `previous_value` (TEXT)
- `new_value` (TEXT)
- `change_source` (TEXT NOT NULL): `MANUAL_FORM` | `VOICE_CONFIRMED` | `SYSTEM_SEED`
- `changed_at` (TEXT ISO-8601 UTC)

### `health_records`
Primary physiological and behavioral time-series measurements.
- `id` (INTEGER PK)
- `astronaut_id` (INTEGER FK -> `astronauts.id` ON DELETE CASCADE)
- `recorded_at` (TEXT ISO-8601 UTC NOT NULL, indexed)
- `heart_rate_bpm` (REAL): Resting or sampled heart rate (beats per minute).
- `spo2_pct` (REAL): Peripheral capillary oxygen saturation (%).
- `sleep_duration_hrs` (REAL): Total sleep period in hours.
- `sleep_quality_score` (REAL): 0–100 composite sleep efficiency score.
- `deep_sleep_hrs` (REAL): Slow-wave sleep duration (hours).
- `rem_sleep_hrs` (REAL): REM sleep duration (hours).
- `activity_minutes` (INTEGER): Daily structured exercise / EVA minutes.
- `exercise_type` (TEXT): e.g., `ARED Resistive`, `Treadmill T2`, `Cycle Ergometer`, `Rest`.
- `stress_score` (REAL): Self-reported subjective stress scale (1–10).
- `mood_score` (REAL): Self-reported mood scale (1–10).
- `mood_notes` (TEXT): Optional operator or voice-confirmed context note.
- `data_source` (TEXT NOT NULL): `SYNTHETIC` | `MANUAL` | `REAL`.
- `is_cleaned` (INTEGER BOOLEAN): `1` if passed range validation/normalization.
- `missing_imputed` (INTEGER BOOLEAN): `1` if missing field was forward-filled or median-imputed during ingestion.
- `created_at` (TEXT ISO-8601 UTC)

### `environmental_records`
Spacecraft habitat life-support and radiation telemetry.
- `id` (INTEGER PK)
- `mission_name` (TEXT NOT NULL)
- `habitat_zone` (TEXT NOT NULL): e.g., `Crew Quarters`, `Medical Bay`, `Lab Module`.
- `recorded_at` (TEXT ISO-8601 UTC NOT NULL, indexed)
- `radiation_msv_day` (REAL): Absorbed/effective radiation dose rate ($\text{mSv/day}$).
- `cabin_co2_ppm` (REAL): Carbon dioxide concentration ($\text{ppm}$).
- `oxygen_pct` (REAL): Cabin $\text{O}_2$ volume percentage (%).
- `temperature_c` (REAL): Ambient dry-bulb temperature ($^\circ\text{C}$).
- `humidity_pct` (REAL): Relative humidity (%).
- `pressure_kpa` (REAL): Total cabin atmospheric pressure ($\text{kPa}$).
- `data_source` (TEXT NOT NULL): `SYNTHETIC` | `MANUAL` | `REAL`.
- `created_at` (TEXT ISO-8601 UTC)

### `sleep_records`, `activity_records`, `mood_logs`
Normalized domain-specific sub-logs linked to `astronaut_id` with explicit `data_source` and timestamps for granular querying and voice-log ingestion.

### `anomaly_alerts`
Explainable ML and statistical baseline deviation alerts (never medical diagnoses).
- `id` (INTEGER PK)
- `astronaut_id` (INTEGER FK -> `astronauts.id` ON DELETE CASCADE)
- `detected_at` (TEXT ISO-8601 UTC NOT NULL)
- `variables_involved` (TEXT NOT NULL): Comma-separated variable list.
- `observed_values_json` (TEXT NOT NULL): JSON snapshot of observed metric values.
- `baseline_reference_json` (TEXT NOT NULL): Personal rolling mean, standard deviation, and IQR bounds.
- `deviation_description` (TEXT NOT NULL): Quantified z-score / directional shift summary.
- `detection_method` (TEXT NOT NULL): `PERSONAL_ZSCORE_ROLLING` | `ISOLATION_FOREST_MULTIVARIATE` | `TREND_SLOPE_SHIFT`.
- `anomaly_score` (REAL NOT NULL): Normalized `[0.0, 1.0]` deviation score.
- `confidence_level` (TEXT NOT NULL): `LOW` | `MODERATE` | `HIGH` (based on sample window completeness).
- `severity_tier` (TEXT NOT NULL): `ADVISORY` | `ELEVATED` | `CRITICAL_REVIEW`.
- `status` (TEXT NOT NULL): `ACTIVE` | `ACKNOWLEDGED` | `RESOLVED`.
- `data_source` (TEXT NOT NULL): Provenance of underlying telemetry (`SYNTHETIC` | `MANUAL` | `REAL`).
- `explanation` (TEXT NOT NULL): Human-readable feature contribution & environmental correlation summary.
- `uncertainty_statement` (TEXT NOT NULL): Mandatory epistemic disclaimer stating personal baseline scope and non-diagnostic boundary.
- `acknowledged_at` (TEXT ISO-8601 UTC)

### `datasets`, `research_documents`, `assistant_conversations`, `audit_logs`
Track dataset provenance metadata, verified NASA research chunks for local RAG, local conversation logs with citations, and immutable security/data-change audit events.
