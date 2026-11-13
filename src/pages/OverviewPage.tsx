import React, { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  AnomalyAlert,
  Astronaut,
  EnvironmentalRecord,
  HealthRecord,
  PageId,
  SystemStatus,
} from '../types/domain';

interface OverviewPageProps {
  astronauts: Astronaut[];
  healthRecords: HealthRecord[];
  envRecords: EnvironmentalRecord[];
  anomalies: AnomalyAlert[];
  systemStatus: SystemStatus | null;
  selectedAstronautId: number | null;
  onNavigate: (page: PageId) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  astronauts,
  healthRecords,
  envRecords,
  anomalies,
  systemStatus,
  selectedAstronautId,
  onNavigate,
}) => {
  const [imgError, setImgError] = useState(false);

  const filteredHealth = selectedAstronautId
    ? healthRecords.filter((h) => h.astronaut_id === selectedAstronautId)
    : healthRecords;

  const latestHealth = filteredHealth[filteredHealth.length - 1] || null;
  const latestEnv = envRecords[envRecords.length - 1] || null;
  const activeAlerts = anomalies.filter(
    (a) => a.status === 'ACTIVE' && (!selectedAstronautId || a.astronaut_id === selectedAstronautId)
  );

  // Build chart series from last 14 days
  const chartRows = (selectedAstronautId ? filteredHealth : healthRecords.filter((h) => h.astronaut_id === (astronauts[0]?.id ?? 1)))
    .slice(-14)
    .map((h) => {
      const dateStr = h.recorded_at.slice(5, 10);
      const envMatch = envRecords.find((e) => e.recorded_at.slice(0, 10) === h.recorded_at.slice(0, 10));
      return {
        date: dateStr,
        heartRate: h.heart_rate_bpm,
        spo2: h.spo2_pct,
        sleepHrs: h.sleep_duration_hrs,
        co2Ppm: envMatch?.cabin_co2_ppm ?? null,
      };
    });

  const syntheticHealthCount = healthRecords.filter((h) => h.data_source === 'SYNTHETIC').length;
  const manualHealthCount = healthRecords.filter((h) => h.data_source === 'MANUAL').length;

  return (
    <div className="space-y-6">
      {/* Operational & Provenance Banner */}
      <div className="bg-[#0D111A] border border-slate-800/90 rounded-lg p-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="text-xs font-mono text-cyan-400">
              Offline Decision-Support Prototype · Personal Baseline Monitoring
            </div>
            <h2 className="font-display text-2xl font-semibold text-slate-100 leading-tight text-balance">
              Autonomous Crew Physiology & Habitat Telemetry Console
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed max-w-2xl">
              Monitors individual astronaut baselines against habitat life-support streams across deep-space communication delays.
              Statistical alerts support operator triage and never diagnose medical conditions.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-slate-800/80">
            <div>
              <div className="text-xs text-slate-400">Crew Profiles</div>
              <div className="text-2xl font-mono font-semibold text-slate-100 mt-1 tabular-nums">
                {astronauts.length}
              </div>
              <div className="text-[11px] font-mono text-amber-300 mt-0.5">
                {astronauts.filter((a) => a.data_source === 'SYNTHETIC').length} SYNTHETIC · {astronauts.filter((a) => a.data_source === 'MANUAL').length} MANUAL
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Latest Resting HR</div>
              <div className="text-2xl font-mono font-semibold text-slate-100 mt-1 tabular-nums">
                {latestHealth?.heart_rate_bpm ?? '--'}
                <span className="text-xs text-slate-400 ml-1">bpm</span>
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                SpO2 {latestHealth?.spo2_pct ?? '--'}% · {latestHealth?.data_source ?? 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Cabin Environment</div>
              <div className="text-2xl font-mono font-semibold text-slate-100 mt-1 tabular-nums">
                {latestEnv?.cabin_co2_ppm ?? '--'}
                <span className="text-xs text-slate-400 ml-1">ppm</span>
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                Rad {latestEnv?.radiation_msv_day ?? '--'} mSv/d · {latestEnv?.oxygen_pct ?? '--'}% O2
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Active Alerts</div>
              <div className={`text-2xl font-mono font-semibold mt-1 tabular-nums ${activeAlerts.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {activeAlerts.length}
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                Personal Z-Score + Multi-Var
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-md overflow-hidden border border-slate-800/80 bg-[#07090E] min-h-[210px] flex items-center justify-center relative">
          {!imgError ? (
            <img
              src="/src/assets/images/mission_habitat_schematic_1794596747354.jpg"
              alt="Orbital crew habitat and biomedical monitoring module technical schematic"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover lg:h-full"
            />
          ) : (
            <div className="p-6 text-center text-slate-400 text-xs font-mono">
              Habitat Telemetry Schematic · ECLSS & Crew Medical Bay
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#07090E]/90 via-[#07090E]/50 to-transparent px-4 py-2.5 flex items-center justify-between text-[11px] font-mono text-slate-300">
            <span>ARTEMIS-SIM-04 · Habitat Module</span>
            <span>ECLSS + Crew Bay</span>
          </div>
        </div>
      </div>

      {/* Primary Chart & Active Anomaly Triage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-[#0D111A] border border-slate-800/90 rounded-lg p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-100">
                14-Day Personal Heart Rate & Sleep Trajectory
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {selectedAstronautId
                  ? `Filtered to selected crew ID ${selectedAstronautId}`
                  : `Showing primary crew (${astronauts[0]?.call_sign || 'CDR-01'}) · Source: ${latestHealth?.data_source || 'SYNTHETIC'}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('health')}
              className="text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors whitespace-nowrap"
            >
              Open Full Telemetry
            </button>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartRows} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" stroke="#64748B" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
                <YAxis yAxisId="hr" stroke="#06B6D4" domain={['auto', 'auto']} tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
                <YAxis yAxisId="sleep" orientation="right" stroke="#F59E0B" domain={[2, 10]} tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0B0E17',
                    borderColor: '#1E293B',
                    fontSize: '12px',
                    fontFamily: 'IBM Plex Mono',
                  }}
                />
                <Line yAxisId="hr" type="monotone" dataKey="heartRate" name="Heart Rate (bpm)" stroke="#06B6D4" strokeWidth={2} dot={{ r: 2.5 }} />
                <Line yAxisId="sleep" type="monotone" dataKey="sleepHrs" name="Sleep (hrs)" stroke="#F59E0B" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="lg:col-span-5 bg-[#0D111A] border border-slate-800/90 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-base font-semibold text-slate-100">
                Active Personal-Baseline Alerts
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('anomalies')}
                className="text-xs font-medium text-cyan-400 hover:text-cyan-300 whitespace-nowrap"
              >
                Inspect All
              </button>
            </div>

            {activeAlerts.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400 border border-dashed border-slate-800 rounded-md">
                No active baseline deviations detected in current filter.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {activeAlerts.slice(0, 4).map((alert) => (
                  <div key={alert.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className={alert.severity_tier === 'CRITICAL_REVIEW' ? 'text-rose-400' : 'text-amber-400'}>
                        {alert.severity_tier} · {alert.call_sign}
                      </span>
                      <span className="text-slate-500">
                        {alert.detected_at.slice(0, 10)} · {alert.data_source}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                      {alert.deviation_description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 leading-relaxed">
            Alerts flag deviations relative to each astronaut's own rolling baseline and are not medical diagnoses.
          </div>
        </section>
      </div>

      {/* Bottom 3-Column Summary: Recent Activities, Data Provenance, Local AI Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <section className="bg-[#0D111A] border border-slate-800/90 rounded-lg p-5">
          <h3 className="font-display text-sm font-semibold text-slate-100 mb-3">Recent Crew Activities</h3>
          <div className="divide-y divide-slate-800/70 text-xs">
            {filteredHealth.slice(-4).reverse().map((r) => (
              <div key={r.id} className="py-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-slate-200 truncate">{r.exercise_type}</div>
                  <div className="text-slate-500 font-mono text-[11px]">
                    {r.recorded_at.slice(0, 10)} · {r.data_source}
                  </div>
                </div>
                <div className="font-mono text-slate-300 tabular-nums shrink-0">
                  {r.activity_minutes ?? 0} min
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-[#0D111A] border border-slate-800/90 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-sm font-semibold text-slate-100">Data Provenance Summary</h3>
            <button
              type="button"
              onClick={() => onNavigate('transparency')}
              className="text-xs text-cyan-400 hover:text-cyan-300"
            >
              Registry
            </button>
          </div>
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Synthetic Benchmark Telemetry</span>
              <span className="font-mono text-amber-300 tabular-nums">{syntheticHealthCount} records</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Manual & Voice-Confirmed Logs</span>
              <span className="font-mono text-cyan-300 tabular-nums">{manualHealthCount} records</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Verified NASA Catalogs</span>
              <span className="font-mono text-emerald-400 tabular-nums">
                {systemStatus?.counts.datasets ?? 9} entries
              </span>
            </div>
            <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-800/80">
              Synthetic data is strictly separated by row-level provenance tags and never presented as real flight records.
            </p>
          </div>
        </section>

        <section className="bg-[#0D111A] border border-slate-800/90 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-sm font-semibold text-slate-100">Local AI & Connectivity</h3>
            <button
              type="button"
              onClick={() => onNavigate('assistant')}
              className="text-xs text-cyan-400 hover:text-cyan-300"
            >
              Open Assistant
            </button>
          </div>
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Backend Runtime</span>
              <span className="font-mono text-slate-200">{systemStatus?.runtime_mode || 'Preview'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Ollama ({systemStatus?.ollama.preferred_model || 'qwen2.5:3b'})</span>
              <span className={`font-mono ${systemStatus?.ollama.connected ? 'text-emerald-400' : 'text-amber-400'}`}>
                {systemStatus?.ollama.connected ? 'Connected' : 'Offline'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">NASA Research Corpus</span>
              <span className="font-mono text-slate-200 tabular-nums">
                {systemStatus?.counts.research_documents ?? 7} docs indexed
              </span>
            </div>
            <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-800/80">
              {systemStatus?.ollama.connected
                ? 'Local Ollama LLM ready for offline grounded synthesis.'
                : 'Ollama daemon is offline; local SQLite & NASA RAG retrieval remains functional.'}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};
