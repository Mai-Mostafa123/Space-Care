import React, { useState } from 'react';

interface HazardSpec {
  id: string;
  number: string;
  title: string;
  scientificExplanation: string;
  effects: string[];
  monitoredVariables: string[];
  researchSources: string;
  systemCapabilities: string;
  limitations: string;
}

const FIVE_HAZARDS: HazardSpec[] = [
  {
    id: 'radiation',
    number: '01',
    title: 'Space Radiation',
    scientificExplanation:
      'Beyond Low Earth Orbit and Earth’s protective magnetosphere, crews encounter continuous Galactic Cosmic Rays (GCRs) including high-energy protons and HZE ions, alongside acute Solar Particle Events (SPEs).',
    effects: [
      'Increased lifetime carcinogenesis risk',
      'Potential acute and late central nervous system (CNS) cognitive/motor alterations',
      'Degenerative cardiovascular and tissue remodeling',
      'Acute radiation syndrome risk during unshielded solar flare events',
    ],
    monitoredVariables: ['Cabin Radiation Dosimetry (mSv/day)', 'Longitudinal Resting HR & Sleep (contextual only)'],
    researchSources: 'NASA Human Research Roadmap (Space Radiation Element); OSDR Inspiration4 OSD-569/571 multi-omics studies.',
    systemCapabilities:
      'Tracks habitat radiation dose rates in Environment Monitoring, flags SPE-like dose excursions, and retrieves verified NASA HRP radiation summaries via local RAG.',
    limitations:
      'CRITICAL SCIENTIFIC BOUNDARY: Wearable vital signs (heart rate, SpO2) do NOT directly measure absorbed ionizing radiation dose; dedicated spacecraft dosimeters and hematologic/molecular assays are required.',
  },
  {
    id: 'isolation',
    number: '02',
    title: 'Isolation and Confinement',
    scientificExplanation:
      'Small crews inhabit cramped, artificially lit, acoustically noisy spacecraft modules for months to years separated from Earth, family, and natural 24-hour solar zeitgebers.',
    effects: [
      'Circadian desynchronization and shortened/fragmented sleep architecture',
      'Elevated subjective stress, fatigue, and mood decrements',
      'Interpersonal team friction and cognitive vigilance decline',
    ],
    monitoredVariables: ['Sleep Duration (hrs)', 'Deep / REM Sleep & Quality Index', 'Stress Logs (1–10)', 'Mood Logs (1–10)'],
    researchSources: 'NASA HRP Behavioral Health and Performance (BHP) Evidence Reports; ISS & HERA ground analog findings.',
    systemCapabilities:
      'Maintains private local mood/stress journals, tracks personal sleep baselines without population bias, and supports hands-free voice logging with explicit user confirmation.',
    limitations:
      'Self-reported mood and stress scores are subjective and cannot diagnose psychiatric or behavioral health conditions.',
  },
  {
    id: 'distance',
    number: '03',
    title: 'Distance from Earth',
    scientificExplanation:
      'Deep-space missions (lunar and Martian trajectories) experience severe one-way light-time communication delays (up to ~22 minutes each way at Mars opposition), conjunction blackouts, and no rapid emergency evacuation or resupply.',
    effects: [
      'Inability to rely on real-time Earth flight-surgeon guidance during acute events',
      'Increased cognitive and operational burden on autonomous crew medical officers',
    ],
    monitoredVariables: ['Local SQLite Telemetry Store', 'Offline Personal-Baseline ML Models', 'Local Ollama + ChromaDB RAG'],
    researchSources: 'NASA HRP Exploration Medical Capability (ExMC) Risk Framework.',
    systemCapabilities:
      'Designed strictly for Earth-independent offline operation: local SQLite persistence, local Scikit-learn Isolation Forest persistence, and local 3B quantized Ollama RAG retrieval.',
    limitations:
      'Hardware-constrained local 3B models prioritize low memory footprint (8 GB RAM) and must always be paired with source citations and explicit uncertainty statements.',
  },
  {
    id: 'gravity',
    number: '04',
    title: 'Gravity Fields (Altered Gravity)',
    scientificExplanation:
      'Crews traverse hypergravity during launch/re-entry, prolonged microgravity in orbital transit, and partial gravity (0.16g Moon, 0.38g Mars).',
    effects: [
      'Cephalad fluid redistribution and plasma volume reduction',
      'Cardiovascular deconditioning and altered orthostatic tolerance',
      'Bone mineral density loss and skeletal muscle atrophy',
      'Sensorimotor and vestibular space motion sickness',
    ],
    monitoredVariables: ['Resting Heart Rate (bpm)', 'Physical Activity Minutes', 'Countermeasure Modality (ARED / T2 / CEVIS)'],
    researchSources: 'NASA HRP Cardiovascular, Bone, Muscle, and Sensorimotor Evidence Reports.',
    systemCapabilities:
      'Tracks daily resistive/aerobic countermeasure adherence alongside individual resting heart rate baselines to highlight multi-day cardiovascular drift.',
    limitations:
      'Wearable HR and exercise logs do NOT directly measure bone mineral density (DXA), muscle cross-sectional area, or ocular/intracranial fluid shifts (SANS).',
  },
  {
    id: 'environment',
    number: '05',
    title: 'Hostile and Closed Environments',
    scientificExplanation:
      'Spacecraft are closed ecological loops where crew, hardware, recycled air, and reclaimed water coexist without natural convection in microgravity, allowing localized CO2 pockets and microbial/immune shifts.',
    effects: [
      'CO2-associated headache, lethargy, and subtle respiratory/sleep disruption',
      'Altered host-microorganism dynamics and immune dysregulation',
      'Thermal and humidity discomfort impacting recovery',
    ],
    monitoredVariables: ['Cabin CO2 (ppm)', 'Oxygen (%)', 'Temperature (°C)', 'Relative Humidity (%)', 'Pressure (kPa)', 'SpO2 (%)'],
    researchSources: 'NASA OSDR Environmental Data Application (EDA); NASA HRP Immunology & Toxicology Evidence Reports; OSDR OSD-570/575.',
    systemCapabilities:
      'Ingests all 6 habitat life-support channels and aligns them via timestamp with crew physiology in multivariable Isolation Forest and correlation checks.',
    limitations:
      'Habitat-level sensors reflect module zone averages rather than localized personal breathing-zone microclimates unless personal dosimeters/CO2 badges are worn.',
  },
];

export const HazardsPage: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string>(FIVE_HAZARDS[0].id);
  const active = FIVE_HAZARDS.find((h) => h.id === selectedId) || FIVE_HAZARDS[0];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-slate-100">
          Five NASA Human Spaceflight Hazards Analytical Matrix
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Scientific evidence mapping connecting NASA Human Research Program (HRP) hazards to onboard monitoring capabilities and measurement boundaries.
        </p>
      </div>

      {/* Hazard Selector Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
        {FIVE_HAZARDS.map((h) => {
          const isSelected = h.id === active.id;
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => setSelectedId(h.id)}
              className={`p-3 rounded-lg border text-left transition-colors ${
                isSelected
                  ? 'bg-[#111827] border-cyan-500/60 text-slate-100'
                  : 'bg-[#0D111A] border-slate-800/90 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <div className="font-mono text-[11px] text-cyan-400">{h.number}</div>
              <div className="font-display text-xs font-semibold mt-0.5">{h.title}</div>
            </button>
          );
        })}
      </div>

      {/* Active Hazard Deep Dive */}
      <article className="bg-[#0D111A] border border-slate-800/90 rounded-lg p-6 space-y-6">
        <div className="border-b border-slate-800 pb-4">
          <div className="font-mono text-xs text-cyan-400">NASA HRP Hazard {active.number}</div>
          <h3 className="font-display text-xl font-semibold text-slate-100 mt-1">{active.title}</h3>
          <p className="text-sm text-slate-300 mt-2 leading-relaxed max-w-4xl">
            {active.scientificExplanation}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          <div className="space-y-4">
            <div>
              <h4 className="font-display text-xs font-semibold text-slate-200 mb-2">
                Documented Effects on Astronauts
              </h4>
              <ul className="space-y-1.5 text-slate-300 list-disc pl-4">
                {active.effects.map((eff) => (
                  <li key={eff}>{eff}</li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-display text-xs font-semibold text-slate-200 mb-2">
                Monitored Variables in Aegis
              </h4>
              <div className="text-cyan-300 font-mono space-y-1">
                {active.monitoredVariables.map((v) => (
                  <div key={v}>• {v}</div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="font-display text-xs font-semibold text-slate-200 mb-1.5">
                System Capabilities
              </h4>
              <p className="text-slate-300 leading-relaxed bg-[#07090E] border border-slate-800 rounded-md p-3">
                {active.systemCapabilities}
              </p>
            </div>

            <div>
              <h4 className="font-display text-xs font-semibold text-amber-300 mb-1.5">
                Data Availability & Measurement Limitations
              </h4>
              <p className="text-slate-300 leading-relaxed bg-[#07090E] border border-amber-800/40 rounded-md p-3">
                {active.limitations}
              </p>
            </div>

            <div>
              <h4 className="font-display text-xs font-semibold text-slate-200 mb-1">
                Verified NASA Research Sources
              </h4>
              <p className="text-slate-400 font-mono text-[11px]">{active.researchSources}</p>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
};
