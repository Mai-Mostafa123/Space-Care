# NASA Open Science & Spaceflight Dataset Research

**Project:** Aegis Orbital Health — Astronaut Health Monitoring & Autonomous Medical Decision-Support System  
**Last Updated:** 2026-11-13  
**Classification Policy:** Every dataset in the application registry carries an explicit provenance classification (`REAL`, `SIMULATED`, or `MANUAL`). Synthetic benchmark records generated for development and demonstration are explicitly labeled `SYNTHETIC` and are never mixed with verified human records without preserving source labels.

---

## 1. Candidate Official NASA & Spaceflight Resources Evaluated

### 1.1 NASA Open Science Data Repository (OSDR) — Whole Blood Multi-Omics (Inspiration4)
- **Dataset Name:** Whole Blood Measurements from the SpaceX Inspiration4 Mission
- **Dataset Identifier:** `OSD-569`
- **Original Source:** NASA Open Science Data Repository (OSDR) / SpaceX Inspiration4 Mission (TRISH / Weill Cornell Medicine collaboration)
- **Source Classification:** `REAL` (metadata cataloged; biological multi-omics dataset)
- **Available Variables:** RNA-seq expression matrices, epitranscriptomics, Whole Genome Sequencing (WGS) metadata, clonal hematopoiesis tracking, Complete Blood Count (CBC) summary measures across pre-flight, in-flight/immediate post-flight, and recovery timepoints.
- **File Format:** ISA-Tab metadata (`i_Investigation.txt`, `s_Study.txt`, `a_Assay.txt`), processed count matrices (`.tsv`, `.csv`), MultiQC HTML reports.
- **Number of Records / Subjects:** 4 civilian crew members; longitudinal sampling across pre-flight, return (R+1), and post-flight recovery windows.
- **Time Coverage:** September 2021 Inspiration4 orbital mission (3-day flight + pre/post sampling).
- **Accessibility:** Processed count tables and ISA-Tab metadata are openly discoverable via OSDR; raw human genomic sequence reads (WGS/FASTQ) require controlled-access institutional approval to protect crew genetic privacy.
- **Download / API Method:** OSDR web portal (`https://osdr.nasa.gov/bio/repo/data/studies/OSD-569`) and GeneLab/OSDR REST API (`https://visualization.genelab.nasa.gov/GLOpenAPI/`).
- **Licensing & Usage Restrictions:** NASA Open Science policy / FAIR data principles; controlled human sequence restrictions apply to raw identifiable WGS files.
- **Relevance to Astronaut Monitoring:** Demonstrates longitudinal pre-flight baseline vs. post-flight physiological shifts (immune, hematologic, cellular stress) across non-career astronauts.
- **Limitations:** Not continuous real-time wearable HR/SpO₂ telemetry; 3-day LEO mission duration limits direct extrapolation to multi-month deep-space transits.

---

### 1.2 NASA OSDR — Inspiration4 PBMCs, Plasma, and Serum Panels
- **Dataset Identifiers:** `OSD-570` (PBMCs single-nuclei RNA-seq / ATAC-seq / immune repertoire), `OSD-571` (Plasma proteomics, metabolomics, cfDNA/cfRNA), `OSD-575` (Serum metabolic panels and immune/cardiovascular cytokine arrays)
- **Original Source:** NASA OSDR / Inspiration4 Mission
- **Source Classification:** `REAL` (metadata cataloged)
- **Available Variables:** Single-cell chromatin accessibility, T/B-cell receptor repertoires, circulating cytokines, metabolic biomarkers, cell-free nucleic acids.
- **File Format:** ISA-Tab metadata, `.h5ad` / `.mtx` / `.csv` / `.tsv` processed matrices.
- **Subjects & Coverage:** 4 civilian astronauts, pre-flight / post-flight longitudinal intervals (September 2021).
- **Accessibility:** Processed summary tables openly accessible; controlled access for identifiable raw sequencing.
- **Relevance & Limitations:** Provides empirical evidence of immune, inflammatory, and cardiovascular biomarker perturbation after orbital flight; lacks continuous minute-by-minute environmental or vital-sign time series.

---

### 1.3 NASA OSDR Environmental Data Application (EDA)
- **Dataset Name:** OSDR Environmental Data Application (EDA) Spacecraft Telemetry
- **Dataset Identifier:** `OSDR-EDA` (mission-indexed ISS / Rodent Research environmental streams)
- **Original Source:** NASA Ames Life Sciences Data Archive (ALSDA) integrated into NASA OSDR
- **Source Classification:** `REAL` (metadata & schema reference; mission-specific time-series CSV exports)
- **Available Variables:** Cabin and habitat hardware temperature (°C), relative humidity (%), carbon dioxide partial pressure / concentration ($\text{CO}_2$), and radiation dosimetry telemetry where instrumented on ISS research habitats.
- **File Format:** Structured CSV / JSON time-series via EDA portal and OSDR REST endpoints.
- **Time Coverage:** Multi-mission ISS increments (varies by Rodent Research / habitat payload, typically 30–90+ days).
- **Accessibility:** Open public research access through NASA OSDR EDA interface.
- **Relevance to Astronaut Monitoring:** Directly informs realistic spacecraft environmental telemetry ranges, sampling cadences, and multi-channel time-series normalization for our Environmental Monitoring module (CO₂, temperature, humidity, radiation).
- **Limitations:** Primarily reflects ISS payload/habitat enclosures rather than individual crew wearable telemetry; individual mission streams must be downloaded per study ID.

---

### 1.4 NASA GeneLab Multi-Omics & Space Biology Repository
- **Dataset Name:** NASA GeneLab Repository (integrated within OSDR)
- **Dataset Identifier:** `GLDS / OSD` catalog (`GLOpenAPI`)
- **Original Source:** NASA Ames Research Center / OSDR
- **Source Classification:** `REAL` (catalog & API schema reference)
- **Available Variables:** Multi-omics assays (transcriptomics, proteomics, epigenomics, metabolomics) across spaceflight and ground-analog studies, indexed with radiation dose, gravity level, and mission metadata.
- **File Format:** ISA-Tab, JSON (REST API), CSV/TSV processed counts.
- **Accessibility:** Public REST API (`https://visualization.genelab.nasa.gov/GLOpenAPI/`), AWS Open Data mirror (`s3://nasa-osdr/` or NASA Open Data registry).
- **Limitations:** Model organisms dominate open omics studies; continuous human physiological time-series is limited due to medical privacy rules.

---

### 1.5 NASA Life Sciences Data Archive (LSDA) / NASA Life Sciences Portal (NLSP)
- **Dataset Name:** NASA Life Sciences Data Archive (transitioned to NLSP)
- **Dataset Identifier:** `LSDA / NLSP`
- **Original Source:** NASA Johnson Space Center / Ames Research Center
- **Source Classification:** `REAL` (archive metadata reference; human data subject to Data Request / IRB privacy governance)
- **Available Variables:** De-identified physiological, behavioral, sleep, cardiovascular, musculoskeletal, and medical experiment records from Apollo, Skylab, Space Shuttle, ISS, and ground-analog bed-rest studies.
- **Accessibility:** Public experiment descriptions and metadata catalog; individual human physiological datasets require formal NASA data-request approval and IRB/privacy review.
- **Limitations:** Cannot be bulk-downloaded unauthenticated for real-time continuous human telemetry; hence **no real astronaut vital-sign records are fabricated or bundled**.

---

### 1.6 NASA Human Research Program (HRP) & Human Research Roadmap (HRR)
- **Resource Name:** NASA Human Research Roadmap (`humanresearchroadmap.nasa.gov`)
- **Original Source:** NASA Human Research Program (JSC)
- **Source Classification:** `REAL` (authoritative scientific evidence & risk framework)
- **Available Content:** Evidence Reports, Integrated Research Plan (IRP), and Risk classifications spanning the **Five Hazards of Human Spaceflight**: Space Radiation, Isolation and Confinement, Distance from Earth, Gravity Fields, and Hostile/Closed Environments.
- **Accessibility:** Openly accessible web portal and published Evidence Report PDFs.
- **Relevance:** Forms the grounded knowledge base for our RAG research corpus and Five Hazards analytical module.

---

### 1.7 Aegis Synthetic Physiological & Habitat Benchmark (`AEGIS-SYNTH-30D`)
- **Dataset Identifier:** `AEGIS-SYNTH-30D`
- **Source Classification:** `SIMULATED` (all records explicitly tagged `SYNTHETIC`)
- **Purpose:** Because continuous individual astronaut wearable vital-sign streams (minute/hour HR, SpO₂, sleep staging, mood logs) linked to simultaneous cabin CO₂ and radiation logs are privacy-restricted or non-contiguous in open repositories, this deterministic synthetic benchmark models 30 mission days for 3 fictional crew profiles (`CDR-01`, `BMS-02`, `ENG-03`) with injected labeled perturbations for ML baseline training and evaluation.
- **Strict Separation Guarantee:** Every row carries `data_source = "SYNTHETIC"` in SQLite and is visibly marked `SYNTHETIC` in the UI, reports, and ML alerts.

---

## 2. Summary Registry Matrix

| ID | Dataset / Resource | Classification | Access Method | Bundled Locally? |
|---|---|---|---|---|
| `OSD-569` | Inspiration4 Whole Blood Multi-Omics | `REAL` | OSDR Portal / GLOpenAPI | Metadata & verified research summary |
| `OSD-570` / `OSD-571` / `OSD-575` | Inspiration4 PBMCs, Plasma, Serum | `REAL` | OSDR Portal / GLOpenAPI | Metadata & verified research summary |
| `OSDR-EDA` | OSDR Environmental Data Application | `REAL` | OSDR EDA Portal / REST API | Metadata & schema specification |
| `LSDA-NLSP` | NASA Life Sciences Data Archive / NLSP | `REAL` | Formal Data Request (IRB) | Catalog metadata & limitation notes |
| `NASA-HRR` | NASA Human Research Roadmap | `REAL` | Public Evidence Reports | Verified hazard & evidence corpus |
| `AEGIS-SYNTH-30D` | 30-Day Crew & Habitat Benchmark | `SIMULATED` | Local deterministic generator | Yes (explicitly labeled `SYNTHETIC`) |
| `CREW-MANUAL` | Crew Form & Voice-Confirmed Entries | `MANUAL` | User form / Voice review flow | Yes (labeled `MANUAL`) |
