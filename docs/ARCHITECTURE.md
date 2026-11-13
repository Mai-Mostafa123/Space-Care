# System Architecture — Aegis Orbital Health

## 1. Architectural Overview & Dual-Runtime Compatibility

Aegis Orbital Health is engineered as an **offline-first, modular aerospace physiological monitoring and decision-support system**.

Because Google AI Studio Build Mode executes a **Node.js + Vite/React** runtime on port 3000 (without Python `pip`, Ollama, or ChromaDB daemons running inside the cloud sandbox), the repository cleanly separates:

1. **Frontend Client (`src/`)** — React 19, Vite, TypeScript, Tailwind CSS v4, Recharts. Communicates exclusively through a typed API adapter (`src/services/apiAdapter.ts`) targeting standard `/api/*` REST contracts.
2. **Production Local Backend (`backend/`)** — Complete Python 3.10+ FastAPI + Pydantic v2 + SQLAlchemy + SQLite + Scikit-learn (`IsolationForest`) + Ollama + ChromaDB + Whisper/Vosk pipeline designed to run locally on Windows 11 (8 GB RAM, AMD Vulkan / CPU).
3. **AI Studio Preview Server (`server.ts`)** — Express + Node 22 built-in `node:sqlite` server implementing the exact `/api/*` contract, real persistent SQLite storage, deterministic statistical + multivariate anomaly detection, local TF-IDF/BM25 grounded RAG over verified NASA documents, and structured voice transcript extraction for live browser preview on port 3000.

**Non-Pretense Guarantee:** The preview runtime explicitly identifies itself as `NODE_PREVIEW_RUNTIME` in `/api/system/status` and clearly displays when Ollama (`http://localhost:11434`) or FastAPI (`http://localhost:8000`) is offline vs. active locally. It never pretends Gemini cloud API is Ollama, and never uploads astronaut records to external AI services.

---

## 2. Production Local Data Flow

```
[ Microphone / Form / CSV ]
          │
          ▼
[ React + TypeScript UI ] ──(VITE_API_BASE_URL)──► [ FastAPI (/api/*) ]
                                                          │
          ┌───────────────────────────────────────────────┼───────────────────────────────┐
          ▼                                               ▼                               ▼
[ SQLite + SQLAlchemy ]                        [ Scikit-learn ML Engine ]      [ Local RAG + Ollama ]
 - Normalized Tables                            - Personal 14d Baseline         - ChromaDB Vector Store
 - Provenance: REAL /                           - Rolling Z-Score + Slope       - Local Embeddings
   SYNTHETIC / MANUAL                           - Isolation Forest (Multi-Var)  - Qwen2.5-3B / Llama3.2-3B
 - Audit Logging                                - Persisted .joblib Models      - Grounded NASA Citations
```

---

## 3. Core Engineering Principles

1. **Personal Baseline, Not Population Diagnosis:** Every alert compares an astronaut against their own rolling personal baseline and quantifies sample-window uncertainty. No clinical diagnoses or prescriptions are ever generated.
2. **Strict Data Provenance:** `SYNTHETIC`, `MANUAL`, and `REAL` records are tagged at the database row level and surfaced across every UI table, chart, report, and assistant response.
3. **Hardware-Conscious AI:** Optimized for 8 GB RAM Windows 11 laptops with AMD GPUs (Ollama Vulkan backend or CPU fallback, `qwen2.5:3b` Q4_K_M ~1.9 GB + `nomic-embed-text` ~274 MB, lazy-loaded ML and embedding models).
4. **Offline Autonomy:** Once models and NASA research documents are cached locally, all telemetry ingestion, anomaly detection, voice transcription, RAG retrieval, and LLM synthesis execute with zero internet dependency.
