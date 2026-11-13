# User Guide & NASA Space Apps Demo Scenarios

## 1. Navigating the Control Console

- **Mission Overview:** View roster totals, latest vitals, cabin CO₂/radiation summary, active personal-baseline alerts, data provenance counts, and local Ollama connection status.
- **Astronaut Profiles:** Create, edit, and delete crew profiles with confirmation dialogs, view documentary profile cards, and inspect immutable field-level audit logs.
- **Health Telemetry:** Inspect heart rate, SpO₂, sleep duration, countermeasure exercise, stress, and mood charts across `7D` / `14D` / `30D` windows and filter strictly by `SYNTHETIC` vs `MANUAL` records.
- **Cabin Environment:** Monitor radiation (`mSv/day`), cabin CO₂ (`ppm`), oxygen (`%`), temperature (`°C`), humidity (`%`), and pressure (`kPa`), and log new manual ECLSS checks.
- **Anomaly Detection:** Review personal-baseline deviations, acknowledge or resolve alerts, re-scan crew baselines, and inspect live precision/recall/F1 metrics on `AEGIS-SYNTH-30D`.
- **Local AI Assistant:** Query crew history and NASA HRP/OSDR research with inline citations and clear Ollama offline/online status.
- **Voice Entry:** Record via browser microphone or enter a transcript, extract validated JSON fields, inspect flagged uncertain/missing fields, edit values if needed, and explicitly confirm before saving to SQLite.
- **Daily Reports:** Generate and export JSON or Markdown operational summaries with explicit non-diagnostic disclaimers.
- **Five NASA Hazards & Data Transparency:** Explore NASA's five human spaceflight hazards alongside full dataset provenance and limitations.

---

## 2. Suggested NASA Space Apps Demo Scenarios

1. **Scenario A — Multi-Variable Cabin CO₂ & Sleep Drift Triage:** Filter the top crew selector to `BMS-02 · SYNTHETIC`, open **Anomaly Detection**, and inspect the `CRITICAL_REVIEW` alert on days 24–26 showing elevated resting HR + shortened sleep + co-occurring cabin CO₂ spike.
2. **Scenario B — Hands-Free Voice Crew Check-In:** Open **Voice Entry**, click **Extract & Validate Structured Fields** on `"Heart rate is 68, SpO2 98.4, slept 7.2 hours, exercise 85 minutes, stress level 3, mood 8."`, review the editable fields, and click **Confirm & Save to Database** (tagged `MANUAL`).
3. **Scenario C — Grounded NASA Research Inquiry:** Open **Local AI Assistant**, select one of the suggested NASA OSDR / Five Hazards questions, and inspect the retrieved `doc_id` citations and uncertainty disclaimer.
4. **Scenario D — Data Provenance Audit:** Open **Data Transparency** and switch between `REAL`, `SIMULATED`, and `MANUAL` filters to verify that synthetic telemetry is never conflated with official NASA datasets.
