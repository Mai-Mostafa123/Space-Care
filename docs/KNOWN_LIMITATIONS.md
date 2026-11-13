# Known Limitations & Environment Constraints — Aegis Orbital Health

1. **Non-Diagnostic Research Prototype:** Does not diagnose illnesses, prescribe treatments, or substitute for flight-surgeon clinical review. Physiological bounds validate data integrity, not clinical health.
2. **Synthetic Time-Series Data Only (`AEGIS-SYNTH-30D`):** NASA OSDR datasets (`OSD-569` to `OSD-575`) are cataloged with verified metadata, abstracts, and scientific limitations, while the 30-day multi-crew daily vital/habitat series is deterministically synthetic (`SYNTHETIC`) because individual longitudinal NASA astronaut medical records (`LSDA`/`NLSP`) are privacy-controlled.
3. **Cloud Sandbox Constraints (Google AI Studio Container):**
   - `pip` is unavailable in Python `3.10.12` here, so `fastapi`, `sqlalchemy`, `scikit-learn`, `pandas`, `chromadb`, `faster-whisper`, and `pytest` cannot be executed inside the sandbox (`BLOCKED BY ENVIRONMENT`). All Python source files were verified with `python3 -m py_compile`.
   - `ollama serve` is not running inside the sandbox; live `qwen2.5:3b` and `nomic-embed-text` generation requires local workstation setup per `docs/INSTALLATION.md`.
   - Node.js `v22.23.2` `node:sqlite` triggers an informational `ExperimentalWarning` on stderr; functionality passed all integration tests.
4. **Unmonitored Physiological & Environmental Modalities:** The current schema does **not** record arterial blood pressure, continuous 12-lead ECG waveforms, blood glucose, DXA bone mineral density, intraocular pressure / optic nerve imaging (`SANS`), or real-time radiation spectrometer counts (radiation is ingested as daily `mSv/day` summary).
5. **Single-Operator Local Security Model:** No multi-user authentication/RBAC is implemented because the prototype targets single-workstation `localhost` operation.
6. **Synthetic Benchmark Evaluation Scope:** Out-of-sample ML metrics (`F1 = 1.0000` on `54` Days 13–30 observations) measure behavior on controlled synthetic perturbations and do not represent real-flight clinical sensitivity/specificity.
