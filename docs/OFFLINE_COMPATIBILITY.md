# Offline Compatibility Audit — Aegis Orbital Health

**Target Scenario:** Autonomous spacecraft/habitat operation under zero internet connectivity (`Distance from Earth` NASA HRP hazard).

---

## 1. Component-by-Component Offline Behavior Matrix

| Subsystem | Offline Capability | Online / External Dependency | Graceful Degradation Behavior |
|-----------|-------------------|------------------------------|-------------------------------|
| **SQLite Persistence (`aegis_preview.db` / `aegis_orbital_health.db`)** | **100% Offline** | None | Reads/writes local disk SQLite file across restarts. |
| **Personal-Baseline ML Anomaly Detection (`server/ml.ts`, `backend/ml/`)** | **100% Offline** | None | Pure local statistical + Scikit-learn `IsolationForest` inference via `.joblib` artifacts. |
| **NASA Dataset Registry & Research Corpus (`data/metadata/*.json`)** | **100% Offline** | None | Pre-packaged locally in JSON and seeded into SQLite tables. |
| **Local Assets (`src/assets/images/*.jpg`)** | **100% Offline** | None | Bundled locally under `src/assets/images/` (no external image CDNs). |
| **Frontend UI & Recharts (`src/`)** | **99% Offline** | `index.html` links Google Fonts (`fonts.googleapis.com`) | When offline, browser automatically falls back to local system sans/monospace fonts with zero functional failure. |
| **Local AI Assistant (`Ollama` + `ChromaDB`)** | **100% Offline once models pre-pulled** | Requires `ollama pull qwen2.5:3b` & `nomic-embed-text` once prior to disconnection | When `Ollama` is not running, system honestly displays `Ollama Offline`, performs real SQLite + NASA corpus retrieval, and never fabricates LLM synthesis or calls cloud AI. |
| **Voice Entry (`Faster-Whisper` / `Vosk` vs Browser)** | **100% Offline in Python FastAPI once model cached** | Browser `Web Speech API` in Chromium may rely on OS/cloud STT depending on browser | Python `backend/voice/voice_processor.py` runs `faster-whisper base` (`int8`) locally on CPU; Node preview falls back to editable transcript + structured JSON extraction + explicit confirmation. |

---

## 2. Pre-Mission Air-Gap Preparation Checklist

1. Pre-pull local Ollama weights before disconnecting:
   ```bash
   ollama pull qwen2.5:3b
   ollama pull nomic-embed-text
   ```
2. Pre-install Python packages (`pip install -r backend/requirements.txt`) and cache `faster-whisper` `base` model (`python -c "from faster_whisper import WhisperModel; WhisperModel('base', device='cpu', compute_type='int8')"`).
3. Build frontend (`npm run build`) so static assets require zero internet access.
4. *(Optional strict air-gap hardening)* Remove Google Fonts `<link>` tags from `index.html` so zero outbound HTTP font requests are attempted.
