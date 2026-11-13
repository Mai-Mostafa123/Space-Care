# Final Technical Audit Report — Aegis Orbital Health

**Audit Scope:** Full-repository inspection, automated testing, live HTTP/SQLite verification, security hardening, offline capability review, and scientific validation of the **AI-Powered Astronaut Health Monitoring & Autonomous Medical Decision-Support System**.  
**System Status:** **Preview Runtime Verified (`NODE_PREVIEW_RUNTIME`)** · **Python FastAPI/Ollama/Whisper Stack Verified by Static Compilation & Inspection (`BLOCKED BY ENVIRONMENT` for live runtime execution due to missing `pip`, `ollama`, and `faster-whisper` binaries in sandbox)**.

---

## 1. Executive Summary

Aegis Orbital Health implements a dual-runtime local-first architecture:
1. **React 19 + TypeScript + Tailwind CSS v4 + Recharts Frontend (`src/`)** communicating via `src/services/apiAdapter.ts` with 10 functional operational views (`Overview`, `Profiles`, `Health`, `Environment`, `Anomalies`, `Assistant`, `Voice`, `Reports`, `Five NASA Hazards`, `Data Transparency`).
2. **Express + Node 22 `node:sqlite` Preview Runtime (`server.ts`, `server/`)** executing real SQLite persistence, input validation, personal-baseline ML anomaly detection, deterministic grounded NASA corpus retrieval, voice transcript structured extraction, and daily operational reporting on port 3000.
3. **Python FastAPI + SQLAlchemy + Scikit-learn + ChromaDB + Ollama + Faster-Whisper Production Backend (`backend/`)** providing complete local production parity for Windows 11 / Linux offline workstations.

---

## 2. Issues Identified & Fixed During Audit

| # | Severity | Component | Defect Identified | Fix Applied | Re-Test Result |
|---|----------|-----------|-------------------|-------------|----------------|
| 1 | High | `backend/ml/anomaly_detector.py`, `server/ml.ts` | **Train/Test Data Leakage:** Previous benchmark evaluated across all 90 rows while fitting `StandardScaler`/`IsolationForest` on all 30 days per crew, and `server/ml.ts` sliced `rows.slice(0, 14)` where `ENG-03` had an injected anomaly at Day 14 (index 13). | Split strictly into clean baseline Days 1–12 (`iloc[:12]` / `slice(0, 12)`) for baseline fitting/scaling/IsolationForest training and Days 13–30 (`54` rows, `6` anomalies) for out-of-sample evaluation. | `PASSED` in Vitest & `tsx` (`TP=6, FP=0, FN=0, TN=48, F1=1.0000`). |
| 2 | High | `backend/app/services/data_pipeline.py` | **Causal Future Data Leakage:** Used `.bfill()` for imputation and `pd.merge_asof(..., direction="nearest")` which looked ahead to future environmental/health rows. | Replaced `.bfill()` with causal `.ffill()` + initial valid fallback and changed `merge_asof` to `direction="backward"`. | `py_compile` `PASSED`; live `pandas` execution `BLOCKED BY ENVIRONMENT`. |
| 3 | High | `server.ts` | **Missing Route Validation, Reactive ML Trigger & Error Handler:** `POST /api/environment` and `POST /api/astronauts` lacked numeric range bounds; invalid `:id` params passed `NaN` into queries; `new Date(raw).toISOString()` threw `RangeError` on invalid strings; `POST /api/health` did not populate normalized sub-tables or re-run anomaly detection; no global JSON/500 error middleware existed. | Added `parsePositiveId()`, `safeIsoTimestamp()`, `VALID_SOURCES` whitelist, physical bounds on environment & mission days, normalized inserts into `sleep_records`/`activity_records`/`mood_logs`/`audit_logs`, reactive `runAnomalyDetectionForAstronaut()`, `app.disable('x-powered-by')` + security headers, and global `400`/`500` error middleware. | `PASSED` in Vitest `server/server.test.ts`. |
| 4 | Medium | `server/rag.ts`, `backend/rag/rag_pipeline.py` | **Over-Permissive Lexical Matching & Unmonitored Metrics:** Generic corpus terms (`astronauts`, `space`, `nasa`) could trigger false citation hits on out-of-corpus questions; queries asking for unmonitored vitals (`blood pressure`, `ECG`, `glucose`, `DXA`) needed explicit refusal of non-existent telemetry. | Added explicit unmonitored-telemetry notice, filtered generic corpus stopwords, required `>=2` substantive token matches for 4+ token queries, and returned explicit insufficient-evidence response with `0` citations for out-of-corpus queries. | `PASSED` in Vitest & live HTTP verification. |
| 5 | Medium | `.gitignore` | **Runtime Artifacts Tracked:** SQLite WAL/DB files (`*.db*`, `data/processed/`) and Python caches (`__pycache__/`, `.venv/`, `.pytest_cache/`) were omitted from `.gitignore`. | Updated `.gitignore` to exclude runtime DBs, caches, and virtualenvs while preserving `.env.example` and `data/synthetic/`. | Verified via inspection. |
| 6 | Low | `backend/` & `backend/app/api/anomalies.py` | **Missing `__init__.py` & Status Reset Bug:** Python subpackages lacked `__init__.py` markers; `PATCH /api/anomalies/{id}` did not clear `acknowledged_at` when re-opened to `ACTIVE`. | Created `__init__.py` across all 12 Python package directories; cleared `acknowledged_at = None` on `ACTIVE` transition. | `py_compile` `PASSED`. |

---

## 3. Component Readiness Matrix

| Component | Runtime Status | Test Coverage | Notes |
|-----------|---------------|---------------|-------|
| React Frontend (`src/`) | Operational (Port 3000 + `vite build`) | `6/6` Vitest + RTL tests `PASSED` | All 10 views wired to real `/api/*` calls; zero dead buttons or mock-only panels. |
| Express + `node:sqlite` Backend (`server.ts`, `server/`) | Operational (Port 3000) | `4/4` Vitest Node integration tests `PASSED` | Persists across restarts; enforces validation, isolation, reactive ML, grounded RAG, and voice extraction. |
| Python FastAPI Backend (`backend/`) | Static verified (`py_compile` exit `0`) | `backend/tests/test_api_and_ml.py` written (`BLOCKED BY ENVIRONMENT`) | Cannot run `pytest`/`uvicorn` in Node-only sandbox (no `pip`). |
| Ollama + ChromaDB Local AI | Offline-graceful (`ollama.connected: false`) | Tested offline fallback & unmonitored/unknown queries (`PASSED`) | Live `qwen2.5:3b` / `nomic-embed-text` inference `BLOCKED BY ENVIRONMENT` (no Ollama daemon). |
| Whisper / Vosk Audio Transcription | Browser Web Speech + HTTP `501` notice in Node preview | Transcript -> JSON -> confirmation tested (`PASSED`) | Local `faster-whisper` binary inference lives in `backend/voice/voice_processor.py` (`BLOCKED BY ENVIRONMENT` in Node sandbox). |
