# Installation & Local Execution Guide (Windows 11 / 8 GB RAM / AMD GPU)

This guide explains how to export and run **Aegis Orbital Health** fully offline on a local workstation using the Python FastAPI + SQLite + Scikit-learn + Ollama + ChromaDB + Faster-Whisper stack.

---

## 1. Hardware & Model Selection (8 GB RAM, Windows 11, AMD GPU)

- **Do NOT assume CUDA:** Windows 11 AMD GPUs do not support native ROCm on bare-metal Windows; **Ollama on Windows automatically uses Vulkan** for AMD Radeon GPU layer offloading when up-to-date AMD Adrenalin drivers are installed, and falls back gracefully to CPU inference.
- **Recommended Ollama Chat Model:** `qwen2.5:3b` (`Q4_K_M`, ~1.9 GB on disk, ~4.0–5.0 GB total RAM overhead during inference). Alternative: `llama3.2:3b` (`Q4_K_M`, ~2.0 GB).
- **Recommended Local Embedding Model:** `nomic-embed-text` (~274 MB).
- **Recommended Local Speech-to-Text:** `faster-whisper` (`base` with `int8` CPU quantization, <500 MB RAM) or `vosk` lightweight small English model (~50 MB).

### Model Trade-Offs on 8 GB RAM
| Model | Disk Size | Peak RAM | Best Use | Limitation on 8 GB RAM |
|---|---|---|---|---|
| `qwen2.5:3b` (Recommended) | ~1.9 GB | ~4.2 GB | Structured reasoning & RAG citations | Avoid >8K context windows with heavy browser tabs open |
| `llama3.2:3b` | ~2.0 GB | ~4.4 GB | General conversational instruction following | Slightly larger KV cache at long contexts |
| `qwen2.5:7b` / `llama3.1:8b` | ~4.7 GB | ~7.5+ GB | Higher synthesis nuance | **Not recommended on 8 GB Windows 11** due to OS memory pressure/swapping |

---

## 2. Step-by-Step Local Setup Commands

### Step 1 — Install and Start Ollama
1. Download Ollama for Windows from `https://ollama.com/` and install.
2. Open PowerShell or Command Prompt and pull the lightweight quantized models while online:
```powershell
ollama serve
ollama pull qwen2.5:3b
ollama pull nomic-embed-text
```

### Step 2 — Generate Synthetic Benchmark Data (Optional Re-run)
```powershell
python scripts/generate_synthetic_data.py
```

### Step 3 — Initialize & Start the Python FastAPI Backend
```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
On startup, FastAPI automatically creates `data/processed/aegis_orbital.db`, seeds the verified NASA dataset registry (`REAL`), NASA research corpus (`REAL`), and labeled `AEGIS-SYNTH-30D` benchmark (`SYNTHETIC`), and trains/persists per-astronaut Isolation Forest `.joblib` artifacts.
OpenAPI Swagger docs will be available at `http://127.0.0.1:8000/docs`.

### Step 4 — Index Research Documents into ChromaDB (Optional Manual Trigger)
```powershell
curl -X POST http://127.0.0.1:8000/api/assistant/index
```

### Step 5 — Start the React Frontend Linked to FastAPI
In a second terminal at the project root:
```powershell
npm install
set VITE_API_BASE_URL=http://127.0.0.1:8000
npm run build
npx vite preview --port 3000
```
*(For development mode against FastAPI: `set VITE_API_BASE_URL=http://127.0.0.1:8000 && npx vite --port 3000`)*

### Step 6 — Run Automated Tests
```powershell
# Frontend + Node API + ML integration tests
npm test

# Python FastAPI + Scikit-learn + Pytest suite (run inside backend/.venv)
cd backend
pytest -v
```
