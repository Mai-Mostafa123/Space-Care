# QA & Testing Report — Aegis Orbital Health

**Date:** 2026-11-13  
**Environment:** Google AI Studio Build Mode (Node.js v22.23.2, Python 3.10.12 without `pip` / external Python packages / Ollama daemon)

---

## 1. Test Results Matrix

| Test Category | Target / Scope | Status | Evidence & Notes |
|---|---|---|---|
| Synthetic Benchmark Generation | `scripts/generate_synthetic_data.py` | **PASSED** | Executed with `python3`; generated 90 `SYNTHETIC` health records and 30 `SYNTHETIC` environmental records in `data/synthetic/`. |
| Python Backend Syntax Check | `backend/app/**/*.py`, `backend/ml/*.py`, `backend/rag/*.py`, `backend/voice/*.py`, `backend/tests/*.py` | **PASSED** | Verified via `python3 -m py_compile` across all Python modules with exit code 0. |
| Frontend Component Rendering | `src/test/frontend.test.tsx` (Vitest + React Testing Library) | **PASSED** | Verified `HazardsPage` tab switching and `TransparencyPage` `REAL`/`SIMULATED` filtering (2/2 tests passed). |
| Preview API, SQLite CRUD, ML Benchmark, Voice Extraction, RAG Grounding | `server/server.test.ts` (Vitest + Express + `node:sqlite`) | **PASSED** | Verified `/api/system/status`, astronaut POST/PUT/DELETE, health 422 validation, daily reports, dataset registry, `AEGIS-SYNTH-30D` ML F1 >= 0.75, voice extraction/bounds rejection, and grounded RAG citations (4/4 tests passed). |
| TypeScript Static Typecheck | `npm run lint` (`tsc --noEmit`) | **PASSED** | Verified during final build check. |
| Vite Production Bundle | `npm run build` (`vite build`) | **PASSED** | Verified during final build check. |
| Python FastAPI & Scikit-learn Pytest Execution | `backend/tests/test_api_and_ml.py` | **BLOCKED BY ENVIRONMENT** | Python `pip`, `fastapi`, `sqlalchemy`, `scikit-learn`, `chromadb`, `faster-whisper`, and `pytest` are not installed in the Google AI Studio cloud sandbox. Run `pytest -v` locally after installing `backend/requirements.txt`. |
| Live Ollama Generative Inference & Whisper Audio Binary | `localhost:11434` (`qwen2.5:3b`) & `faster-whisper` | **BLOCKED BY ENVIRONMENT** | No Ollama daemon or microphone audio hardware in the cloud build container. Offline detection and honest fallback messages are verified; run locally per `docs/INSTALLATION.md`. |
