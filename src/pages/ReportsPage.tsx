import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { api } from '../services/apiAdapter';
import type { DailyReport } from '../types/domain';

interface ReportsPageProps {
  selectedAstronautId: number | null;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ selectedAstronautId }) => {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .getDailyReport(selectedAstronautId ?? undefined)
      .then(setReport)
      .finally(() => setLoading(false));
  }, [selectedAstronautId]);

  const exportJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aegis-daily-report-${report.generated_at.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportMarkdown = () => {
    if (!report) return;
    const lines = [
      `# Aegis Orbital Health — Daily Operational Summary`,
      `Generated: ${report.generated_at}`,
      `Data Sources Present: ${report.data_sources_present.join(', ')}`,
      ``,
      `> ${report.non_diagnostic_disclaimer}`,
      ``,
      `## Crew Summaries`,
      ...report.crew_summaries.map(
        (c) =>
          `- **${c.call_sign} (${c.full_name}) [${c.data_source}]**: Latest HR ${c.latest_hr_bpm ?? '--'} bpm (7d avg ${c.seven_day_avg_hr ?? '--'}), SpO2 ${c.latest_spo2_pct ?? '--'}%, Sleep ${c.latest_sleep_hrs ?? '--'}h (7d avg ${c.seven_day_avg_sleep ?? '--'}h)`
      ),
      ``,
      `## Habitat Environmental Summary`,
      report.environmental_summary
        ? `- Radiation: ${report.environmental_summary.radiation_msv_day} mSv/day | Cabin CO2: ${report.environmental_summary.cabin_co2_ppm} ppm | O2: ${report.environmental_summary.oxygen_pct}% | Temp: ${report.environmental_summary.temperature_c} C | Humidity: ${report.environmental_summary.humidity_pct}% | Pressure: ${report.environmental_summary.pressure_kpa} kPa [${report.environmental_summary.data_source}]`
        : `- No environmental records found.`,
      ``,
      `## Active Personal-Baseline Anomalies (${report.active_anomalies_count})`,
      ...report.active_anomalies.map(
        (a) => `- [${a.severity_tier}] ${a.call_sign || ''} (${a.data_source}): ${a.explanation}`
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aegis-daily-report-${report.generated_at.slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="bg-[#0D111A] border border-slate-800 rounded-lg p-10 text-center text-sm text-slate-400">
        Generating daily crew and habitat summary...
      </div>
    );
  }

  if (!report) {
    return (
      <div className="bg-[#0D111A] border border-slate-800 rounded-lg p-10 text-center text-sm text-rose-300">
        Unable to load daily summary report.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-100">Daily Operational Health & Habitat Report</h2>
          <p className="text-xs font-mono text-slate-400 mt-0.5">
            Generated {report.generated_at.slice(0, 19)} UTC · Sources: {report.data_sources_present.join(', ') || 'None'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={exportMarkdown}
            className="px-3.5 py-2 text-xs font-medium bg-[#0D111A] border border-slate-700 text-slate-200 rounded-md hover:border-cyan-500/60 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Markdown</span>
          </button>
          <button
            type="button"
            onClick={exportJson}
            className="px-3.5 py-2 text-xs font-medium bg-cyan-500 text-slate-950 rounded-md hover:bg-cyan-400 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      <div className="p-4 bg-[#0B0E17] border border-amber-800/50 rounded-lg text-xs text-amber-200 leading-relaxed">
        {report.non_diagnostic_disclaimer}
      </div>

      {/* Crew 7-Day Comparison Table */}
      <section className="bg-[#0D111A] border border-slate-800/90 rounded-lg p-5 overflow-x-auto">
        <h3 className="font-display text-sm font-semibold text-slate-100 mb-3">
          Crew Physiological Summary (Latest vs. 7-Day Personal Rolling Mean)
        </h3>
        <table className="w-full text-xs text-left">
          <thead className="text-slate-400 border-b border-slate-800 font-mono">
            <tr>
              <th className="py-2 pr-4">Crew</th>
              <th className="py-2 pr-4">Source</th>
              <th className="py-2 pr-4 text-right">Latest HR / 7d Avg</th>
              <th className="py-2 pr-4 text-right">Latest SpO2 / 7d Avg</th>
              <th className="py-2 text-right">Latest Sleep / 7d Avg</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
            {report.crew_summaries.map((c) => (
              <tr key={c.astronaut_id}>
                <td className="py-2.5 pr-4 font-sans text-slate-200">
                  <span className="font-mono text-cyan-300 mr-2">{c.call_sign}</span>
                  {c.full_name}
                </td>
                <td className={`py-2.5 pr-4 ${c.data_source === 'SYNTHETIC' ? 'text-amber-300' : 'text-cyan-300'}`}>
                  {c.data_source}
                </td>
                <td className="py-2.5 pr-4 text-right text-slate-200">
                  {c.latest_hr_bpm ?? '--'} / {c.seven_day_avg_hr ?? '--'} bpm
                </td>
                <td className="py-2.5 pr-4 text-right text-slate-200">
                  {c.latest_spo2_pct ?? '--'} / {c.seven_day_avg_spo2 ?? '--'} %
                </td>
                <td className="py-2.5 text-right text-slate-200">
                  {c.latest_sleep_hrs ?? '--'} / {c.seven_day_avg_sleep ?? '--'} hrs
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-[#0D111A] border border-slate-800/90 rounded-lg p-5 space-y-3">
          <h3 className="font-display text-sm font-semibold text-slate-100">Latest Habitat Telemetry</h3>
          {report.environmental_summary ? (
            <div className="grid grid-cols-2 gap-3 text-xs font-mono tabular-nums">
              <div>Radiation: <span className="text-slate-100">{report.environmental_summary.radiation_msv_day} mSv/d</span></div>
              <div>Cabin CO2: <span className="text-slate-100">{report.environmental_summary.cabin_co2_ppm} ppm</span></div>
              <div>Oxygen: <span className="text-slate-100">{report.environmental_summary.oxygen_pct}%</span></div>
              <div>Temperature: <span className="text-slate-100">{report.environmental_summary.temperature_c} °C</span></div>
              <div>Humidity: <span className="text-slate-100">{report.environmental_summary.humidity_pct}%</span></div>
              <div>Pressure: <span className="text-slate-100">{report.environmental_summary.pressure_kpa} kPa</span></div>
            </div>
          ) : (
            <div className="text-xs text-slate-400">No habitat telemetry recorded.</div>
          )}
        </section>

        <section className="bg-[#0D111A] border border-slate-800/90 rounded-lg p-5 space-y-3">
          <h3 className="font-display text-sm font-semibold text-slate-100">
            Active Anomaly Digest ({report.active_anomalies_count})
          </h3>
          {report.active_anomalies.length === 0 ? (
            <div className="text-xs text-slate-400">All crew within rolling personal baselines.</div>
          ) : (
            <div className="space-y-2 text-xs">
              {report.active_anomalies.slice(0, 5).map((a) => (
                <div key={a.id} className="p-2.5 bg-[#07090E] border border-slate-800 rounded">
                  <div className="font-mono text-amber-300">
                    {a.severity_tier} · {a.call_sign} · {a.data_source}
                  </div>
                  <p className="text-slate-300 mt-1">{a.explanation}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
