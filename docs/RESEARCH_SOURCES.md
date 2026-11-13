# Verified NASA Research Sources & Citations

All research documents indexed into the local RAG knowledge base and referenced in the Five Hazards module originate strictly from verified official NASA publications and open science repositories. No document titles, dataset identifiers, URLs, or numerical findings are fabricated.

---

## 1. Authoritative Repositories & APIs

1. **NASA Open Science Data Repository (OSDR)**
   - Portal: `https://osdr.nasa.gov/`
   - Biological Data API (`GLOpenAPI`): `https://visualization.genelab.nasa.gov/GLOpenAPI/`
   - Description: Integrates NASA GeneLab multi-omics datasets and the Ames Life Sciences Data Archive (ALSDA) under FAIR principles.

2. **NASA OSDR Environmental Data Application (EDA)**
   - Portal: `https://osdr.nasa.gov/` (Environmental Data Application subsystem)
   - Description: Converts spacecraft engineering and payload environmental streams (temperature, relative humidity, CO₂, radiation dosimetry) into structured, queryable time-series tables.

3. **NASA Inspiration4 Multi-Omics Studies (OSDR)**
   - `OSD-569`: Whole Blood Measurements from the SpaceX Inspiration4 Mission (RNA-seq, WGS, clonal hematopoiesis, CBC).
   - `OSD-570`: Peripheral Blood Mononuclear Cells (PBMCs) single-nuclei RNA-seq / ATAC-seq & immune repertoire.
   - `OSD-571`: Blood Plasma Profiling (proteomics, metabolomics, cfDNA/cfRNA).
   - `OSD-575`: Blood Serum Metabolic Panels and Immune/Cardiovascular Cytokine Arrays.

4. **NASA Life Sciences Data Archive (LSDA) / NASA Life Sciences Portal (NLSP)**
   - Portal: `https://nlsp.nasa.gov/` / `https://lsda.jsc.nasa.gov/`
   - Description: Houses de-identified human spaceflight physiological, behavioral, and medical experiment archives subject to formal data request and privacy protection.

5. **NASA Human Research Program (HRP) & Human Research Roadmap (HRR)**
   - Portal: `https://humanresearchroadmap.nasa.gov/`
   - Overview: `https://www.nasa.gov/hrp/`
   - Description: Defines the Five Hazards of Human Spaceflight, the Integrated Research Plan (IRP), and peer-reviewed HRP Evidence Reports.

---

## 2. Five Hazards Reference Grounding

1. **Space Radiation** — NASA HRP Space Radiation Element (`humanresearchroadmap.nasa.gov`): Galactic cosmic rays (GCRs), solar particle events (SPEs), and trapped radiation belts pose cumulative risks to carcinogenesis, central nervous system function, cardiovascular health, and acute radiation effects.
2. **Isolation and Confinement** — NASA HRP Behavioral Health and Performance (BHP) Evidence Reports: Prolonged mission confinement in small habitats affects sleep architecture, circadian alignment, mood, stress resilience, and team cohesion.
3. **Distance from Earth** — NASA HRP Exploration Medical Capability (ExMC): Deep-space missions face communication latencies (up to ~22 minutes one-way at Mars opposition) and lack rapid resupply or evacuation, requiring autonomous onboard medical decision-support tools.
4. **Gravity Fields (Altered Gravity)** — NASA HRP Sensorimotor, Bone, Muscle, and Cardiovascular Evidence Reports: Microgravity and planetary partial gravity cause cephalad fluid shifts, cardiovascular deconditioning, bone mineral density loss, muscle atrophy, and vestibular disruption.
5. **Hostile, Closed Environments** — NASA HRP Immunology, Microbiology, and Toxicology Evidence Reports: Sealed spacecraft environments recycle air and water alongside crew and hardware, altering host-microbiome dynamics, immune regulation, and cabin trace gas / CO₂ exposure profiles.

---

## 3. Local AI & Hardware References

- **Ollama Local LLM Runtime:** `https://ollama.com/` — Supports `Qwen2.5 3B` (`qwen2.5:3b`, ~1.9 GB Q4_K_M) and `Llama 3.2 3B` (`llama3.2:3b`, ~2.0 GB Q4_K_M) plus `nomic-embed-text` (~274 MB) within an 8 GB RAM Windows 11 footprint using Vulkan GPU offloading or CPU fallback.
- **ChromaDB:** `https://www.trychroma.com/` — Local embedded vector database persisted to disk (`./data/chroma_db`) for offline semantic retrieval.
