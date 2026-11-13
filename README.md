# Aegis Orbital Health — AI-Powered Astronaut Health Monitoring & Autonomous Medical Decision-Support System

**NASA Space Apps Challenge Prototype**  
*Personal-baseline physiological monitoring, habitat telemetry integration, explainable anomaly detection, voice-to-structured-JSON logging, and offline-first local RAG powered by Ollama + ChromaDB.*

> **Important Medical & Provenance Notice:** This is a research and medical decision-support prototype, **not** a medical diagnostic system. It never diagnoses diseases, prescribes treatment, or invents clinical thresholds. All demonstration time-series records (`AEGIS-SYNTH-30D`) are explicitly labeled **`SYNTHETIC`** and strictly separated from verified NASA open science catalog metadata (`REAL`) and operator entries (`MANUAL`).

---

## Key Capabilities

1. **Astronaut Profile Management (Module A):** Full SQLite CRUD, immutable field-level edit audit history, manual forms, and voice-confirmed updates.
2. **Health & Habitat Data Pipeline (Module B):** Tracks Heart Rate, SpO₂, Sleep Duration/Quality, Physical Activity, Stress, Mood, plus Radiation (`mSv/day`), Cabin CO₂ (`ppm`), O₂ (`%`), Temperature (`°C`), Humidity (`%`), and Pressure (`kPa`) with timestamp normalization, personal median imputation, and row-level provenance tags.
3. **Personal-Baseline ML Anomaly Detection (Module C):** Individual rolling baselines, z-score deviation checks, and Scikit-learn `IsolationForest` multivariable analysis persisted via `joblib`, with explainable alerts, mandatory uncertainty statements, and synthetic benchmark evaluation (Precision, Recall, F1, FPR, Confusion Matrix).
4. **Local AI Assistant & RAG (Module D):** Grounded retrieval over verified NASA HRP & OSDR documents (`ChromaDB` + `nomic-embed-text` + `Ollama qwen2.5:3b` / `llama3.2:3b`), with honest offline status reporting and zero cloud AI dependency.
5. **Aerospace Control Dashboard & Five NASA Hazards (Module E):** 10-view dark obsidian control console built with React 19, TypeScript, Tailwind CSS v4, and Recharts.

---

## Repository Layout

- `src/` — React + TypeScript + Tailwind + Recharts frontend with unified `src/services/apiAdapter.ts`.
- `server.ts` & `server/` — Express + Node 22 `node:sqlite` preview backend implementing the `/api/*` contract for Google AI Studio preview.
- `backend/` — Complete local production Python FastAPI + SQLAlchemy + SQLite + Scikit-learn + Ollama + ChromaDB + Faster-Whisper backend & Pytest suite.
- `data/` — Verified NASA dataset registry (`dataset_registry.json`), verified NASA research corpus (`nasa_research_corpus.json`), and deterministic `SYNTHETIC` 30-day benchmark (`synthetic_benchmark_30d.json`).
- `scripts/` — Deterministic synthetic benchmark generator (`generate_synthetic_data.py`).
- `docs/` — Complete engineering, dataset research, data dictionary, ML evaluation, RAG, installation, and user documentation.

---

## Quick Start

### Option 1: Local Full Production Stack (FastAPI + Ollama + ChromaDB + Whisper)
See **[docs/INSTALLATION.md](docs/INSTALLATION.md)** for complete Windows 11 (8 GB RAM, AMD Vulkan / CPU) commands.

### Option 2: Preview Runtime (Node.js + SQLite + Vite)
```bash
npm install
npm run dev      # Starts Express + SQLite + Vite on http://localhost:3000
npm test         # Runs Vitest + React Testing Library + API integration tests
npm run build    # Builds production frontend bundle
```

---

## Audit & Verification Reports

- [`docs/FINAL_TECHNICAL_AUDIT.md`](docs/FINAL_TECHNICAL_AUDIT.md) — End-to-end codebase & architecture audit, defect fixes, and readiness matrix.
- [`docs/TEST_RESULTS.md`](docs/TEST_RESULTS.md) — Itemized expected vs. actual test execution ledger (`PASSED` vs `BLOCKED BY ENVIRONMENT`).
- [`docs/SECURITY_AUDIT.md`](docs/SECURITY_AUDIT.md) — Input validation, SQL injection checks, header/error hardening, and secret hygiene.
- [`docs/SCIENTIFIC_VALIDATION.md`](docs/SCIENTIFIC_VALIDATION.md) — Non-diagnostic guardrails, NASA provenance separation, and leakage-free ML verification.
- [`docs/OFFLINE_COMPATIBILITY.md`](docs/OFFLINE_COMPATIBILITY.md) — Air-gapped deep-space operation matrix and pre-mission setup checklist.
- [`docs/KNOWN_LIMITATIONS.md`](docs/KNOWN_LIMITATIONS.md) — Explicit technical, clinical, and sandbox environment boundaries.

