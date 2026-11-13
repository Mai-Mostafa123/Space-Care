# Security Audit Report — Aegis Orbital Health

**Audit Date:** 2026-11-13  
**Scope:** Express (`server.ts`, `server/`), FastAPI (`backend/`), React Frontend (`src/`), Data Files (`data/`), Environment Config, and Dependencies.

---

## 1. Security Controls Verified

1. **Zero Hardcoded Secrets or External Cloud AI Keys:**
   - Verified `server.ts`, `server/`, `backend/`, and `src/` contain zero hardcoded API tokens, credentials, or external Gemini/OpenAI API calls.
   - Confirmed local-only endpoints default to `http://localhost:11434` (`OLLAMA_BASE_URL`) and local SQLite (`data/processed/`).
   - Verified `.env` is ignored by `.gitignore` and only `.env.example` / `backend/.env.example` placeholder templates exist.
2. **SQL Injection Prevention:**
   - Every SQL query in `server.ts`, `server/db.ts`, `server/ml.ts`, and `server/rag.ts` uses parameterized prepared statements (`db.prepare(...).get/all/run(...)`).
   - Python FastAPI (`backend/app/`) uses SQLAlchemy ORM parameterized bindings exclusively.
3. **Input Validation & Bounds Enforcement:**
   - **Express (`server.ts`):** Added `parsePositiveId()` returning HTTP `400` on malformed `:id` or `astronaut_id` values; `safeIsoTimestamp()` returning `422` on invalid timestamps; `VALID_SOURCES` whitelist (`REAL`, `SYNTHETIC`, `MANUAL`); and physiological/environmental physical range checks (`heart_rate_bpm` 20–240, `spo2_pct` 50–100, `sleep_duration_hrs` 0–24, `stress_score`/`mood_score` 1–10, `radiation_msv_day` 0–500, `cabin_co2_ppm` 100–50000, `oxygen_pct` 10–40, `pressure_kpa` 30–130).
   - **FastAPI (`backend/app/schemas/schemas.py`):** Enforces strict Pydantic v2 `Field(ge=..., le=...)` bounds and regex provenance validation.
4. **Error Handling & Information Disclosure Prevention:**
   - Added `app.disable('x-powered-by')`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: no-referrer` in `server.ts`.
   - Added Express error middleware returning `400` for malformed JSON (`SyntaxError`) and generic `500 { detail: 'Internal server error' }` without stack traces.
   - FastAPI (`backend/app/main.py`) logs server exceptions internally and returns generic `500` JSON without stack traces.
5. **Cross-Profile Data Isolation:**
   - All health, sleep, activity, mood, and anomaly queries filter strictly by `astronaut_id`.
   - Foreign keys (`ON DELETE CASCADE`) and automated integration tests verify deleting or updating one astronaut profile never leaks records or alters another astronaut's baselines/alerts.
6. **Upload & Payload Limits:**
   - Express JSON body limit capped at `2mb` (`express.json({ limit: '2mb' })`).
   - Python voice upload endpoint (`backend/app/api/assistant_voice.py`) enforces a `15 MB` upload limit and temporary-file cleanup in `finally`.

---

## 2. Residual Security Findings & Recommendations

| Finding | Risk Level | Description & Mitigation Status |
|---------|------------|---------------------------------|
| **No User Authentication / RBAC** | Informational (Single-Operator Local Prototype) | Designed for single-operator local spacecraft/ground workstation use (`localhost`). If deployed on a multi-user network, add TLS + OAuth2/JWT role-based authentication (`Flight Surgeon` vs `Crew`) before exposure beyond `127.0.0.1`. |
| **External Google Fonts Link in `index.html`** | Low (Privacy / Air-Gapped) | `index.html` requests fonts from `fonts.googleapis.com` when online. Remove those `<link>` tags or self-host `.woff2` files under `public/fonts/` for strict zero-egress air-gapped deployments. |
| **SQLite Unencrypted at Rest** | Low (Prototype) | Uses standard unencrypted SQLite files (`aegis_preview.db` / `aegis_orbital_health.db`) containing only `SYNTHETIC`/`MANUAL` test records. Real crew PII/PHI would require SQLCipher or OS-level full-disk encryption (BitLocker/LUKS). |
