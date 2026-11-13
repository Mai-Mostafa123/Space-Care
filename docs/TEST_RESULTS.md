# Test Results Ledger — Aegis Orbital Health

**Audit Date:** 2026-11-13  
**Runtime Environment Inspected:** Node.js `v22.23.2`, npm `10.9.8`, Python `3.10.12` (standard library only; no `pip`, no `ollama`, no audio hardware).

---

## 1. Automated & Live Verification Summary

| Test ID / Suite | What Was Tested | Expected Result | Actual Observed Result | Status | Limitations / Notes |
|-----------------|-----------------|-----------------|------------------------|--------|---------------------|
| `VITEST-FE-01` (`src/test/frontend.test.tsx`) | `HazardsPage` rendering & tab switching (`Distance from Earth`) | Renders all 5 hazards; switches cleanly | Rendered `NASA HRP Hazard 01` and `Hazard 03` on click | **PASSED** | jsdom environment |
| `VITEST-FE-02` (`src/test/frontend.test.tsx`) | `TransparencyPage` registry & `REAL` vs `SIMULATED` filter | Shows `OSD-569` & hides `AEGIS-SYNTH-30D` when filtered to `REAL` | Filtered cleanly using mocked `api.listDatasets` | **PASSED** | Uses `vi.spyOn(api, 'listDatasets')` |
| `VITEST-FE-03` (`src/test/frontend.test.tsx`) | `ProfilesPage` detail & `Add Astronaut` modal | Opens `Create Manual Astronaut Profile` form | Rendered audit history and opened modal on click | **PASSED** | Mocked `api.getAstronautDetail` |
| `VITEST-FE-04` (`src/test/frontend.test.tsx`) | `AnomaliesPage` out-of-sample metrics & `Acknowledge` action | Shows `54` samples; calls `updateAnomalyStatus(11, 'ACKNOWLEDGED')` | Displayed metrics & invoked `api.updateAnomalyStatus` | **PASSED** | Mocked `api` methods |
| `VITEST-FE-05` (`src/test/frontend.test.tsx`) | `VoicePage` extraction & mandatory confirmation gate | Renders extracted fields & `Confirm & Save` button | Displayed extracted values & confirmation requirement | **PASSED** | Mocked `api.extractVoiceTranscript` |
| `VITEST-FE-06` (`src/test/frontend.test.tsx`) | `AssistantPage` offline notice & query submission | Shows Ollama offline notice and renders cited response | Rendered offline warning & `Grounded NASA Citations (1)` | **PASSED** | Mocked `api.queryAssistant` |
| `VITEST-BE-01` (`server/server.test.ts`) | Voice structured extraction (`health_log` & `profile_update`) | Extracts vitals/mission fields & sets `requires_confirmation: true` | Extracted HR `72`, SpO2 `98.5`, Sleep `7.4`, Mission Day `24` | **PASSED** | Deterministic parser test |
| `VITEST-BE-02` (`server/server.test.ts`) | Voice physiological bounds rejection (`HR 450, SpO2 40`) | Sets `validation_passed: false` & lists >=2 errors | Returned `validation_passed: false` with 2 errors | **PASSED** | Real `server/voice.ts` execution |
| `VITEST-BE-03` (`server/server.test.ts`) | Out-of-sample ML evaluation on `AEGIS-SYNTH-30D` Days 13–30 | `54` held-out rows, `6` positives, `F1 >= 0.75` | `total_samples=54, tp=6, fp=0, fn=0, tn=48, F1=1.0` | **PASSED** | Evaluates `SYNTHETIC` perturbations only |
| `VITEST-BE-04` (`server/server.test.ts`) | End-to-end Express + SQLite API (headers, `400`/`422` validation, CRUD, reactive ML alert, profile isolation, status transitions, DB reopen persistence, cascade delete, daily report, datasets, RAG research/BP/unknown queries) | All assertions pass cleanly; test profile deleted | All HTTP statuses (`200/201/400/422`), isolation, persistence across `createApp()` reopen, and RAG guardrails verified | **PASSED** | Node preview SQLite runtime (`node:sqlite`) |
| `PY-SYNTAX-01` (`python3 -m py_compile`) | Syntax compilation of all `.py` files under `backend/` & `scripts/` | Exit code `0` with zero syntax errors | Exited `0` (`PY_COMPILE_OK`) | **PASSED** | Syntax & bytecode check only |
| `PY-SYNTH-GEN` (`scripts/generate_synthetic_data.py`) | Deterministic synthetic 30-day dataset generation | Generates `90` health + `30` env JSON/CSV records | Generated `data/synthetic/synthetic_benchmark_30d.json` & `.csv` | **PASSED** | Standard library Python |
| `LIVE-BUILD-01` (`npm run build` + `npm run lint`) | Production Vite bundle & TypeScript `tsc --noEmit` | Exit code `0` on both | Verified in final build step (see command output) | **PASSED** | Co-executed via `compile_applet` & `lint_applet` |
| `LIVE-HTTP-01` (`curl` vs `127.0.0.1:3000`) | Live dev server verification (`/api/system/status`, `/api/anomalies/evaluation`, `/api/assistant/query` research + blood pressure + unknown, `/api/reports/daily`) | HTTP `200` with valid JSON & disclaimers | Executed after `restart_dev_server` | **PASSED** | Verified against live server on port 3000 |
| `PYTEST-FASTAPI` (`backend/tests/test_api_and_ml.py`) | FastAPI `TestClient`, SQLAlchemy ORM, Pandas pipeline, Scikit-learn `IsolationForest` | Full Python backend test pass | Cannot install `fastapi`, `sqlalchemy`, `scikit-learn`, `pytest` (`pip` missing in container) | **BLOCKED BY ENVIRONMENT** | Must be executed on local workstation per `docs/INSTALLATION.md` |
| `OLLAMA-LIVE` (`http://localhost:11434`) | Live local LLM inference (`qwen2.5:3b`) & `nomic-embed-text` + `ChromaDB` embeddings | Live RAG synthesis with vector retrieval | No Ollama daemon or ChromaDB package present in cloud sandbox | **BLOCKED BY ENVIRONMENT** | Offline graceful fallback verified (`PASSED`) |
| `WHISPER-AUDIO` (`backend/voice/voice_processor.py`) | Local `faster-whisper` / `Vosk` WAV/WebM audio transcription | Offline binary STT transcription | No audio hardware or `faster-whisper` package in sandbox; Node returns `501` guidance | **BLOCKED BY ENVIRONMENT** | Browser Web Speech + transcript extraction available |

---

## 2. Error & Fix Log During Testing

1. **Test Failure Observed (`VITEST-BE-04` initial run):** `TypeError: Cannot read properties of undefined (reading 'alerts_detected')` at `server/server.test.ts:160`.
   - **Root Cause:** `POST /api/health` returns `alerts_detected` at the JSON root, while the test initially checked `spikeJson.anomaly_scan.alerts_detected`.
   - **Fix & Retest:** Corrected test assertion to `spikeJson.alerts_detected`, cleared intermediate preview DB rows left by the aborted test, and re-ran `npm test` -> `10/10` tests `PASSED`.
