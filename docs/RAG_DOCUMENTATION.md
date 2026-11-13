# Local RAG & Ollama Integration Documentation

## 1. Offline Pipeline Architecture

```
User Question
   │
   ▼
FastAPI (/api/assistant/query)
   ├──► SQLite Personal Records & Active Anomalies (Astronaut Context Assembly)
   ├──► ChromaDB Persistent Vector Store (./data/processed/chroma_db)
   │       └── Local Embeddings via Ollama (`nomic-embed-text`)
   └──► Ollama Local LLM (`qwen2.5:3b` or `llama3.2:3b` at localhost:11434)
           └── Grounded Response + Verified NASA Citations + Uncertainty Notice
```

## 2. Hallucination Prevention & Citation Guardrails

1. **Zero Cloud API Substitution:** The assistant never uses external cloud LLM APIs for astronaut inference and never uploads private SQLite records off-device.
2. **Strict Source Grounding:** All research chunks in `data/metadata/nasa_research_corpus.json` carry explicit `doc_id`, `source_org`, `url`, and `verified_reference` fields sourced from official NASA HRP, OSDR (`OSD-569`, `OSD-570`, `OSD-571`, `OSD-575`), EDA, and LSDA/NLSP publications.
3. **Honest Offline Fallback:** When Ollama (`http://localhost:11434`) is not running (such as inside the AI Studio cloud preview sandbox), the system reports `connected: false`, displays exact local `ollama serve` startup instructions, and returns deterministic SQLite context + retrieved NASA research excerpts without fabricating generative prose.
4. **Epistemic Uncertainty:** Every response includes a non-diagnostic decision-support notice and distinguishes `SYNTHETIC` benchmark records from `MANUAL` entries.
