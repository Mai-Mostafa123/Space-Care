import React, { useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../services/apiAdapter';
import type { Astronaut, HealthRecord } from '../types/domain';

interface HealthPageProps {
  astronauts: Astronaut[];
  healthRecords: HealthRecord[];
  selectedAstronautId: number | null;
  onRefresh: () => Promise<void>;
}

export const HealthPage: React.FC<HealthPageProps> = ({
  astronauts,
  healthRecords,
  selectedAstronautId,
  onRefresh,
}) => {
  const targetAstronautId = selectedAstronautId ?? astronauts[0]?.id ?? 1;
  const [rangeDays, setRangeDays] = useState<7 | 14 | 30>(30);
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'SYNTHETIC' | 'MANUAL'>('ALL');
  const [showAddForm, setShowAddForm] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const [entry, setEntry] = useState({
    heart_rate_bpm: '64',
    spo2_pct: '98.2',
    sleep_duration_hrs: '7.4',
    activity_minutes: '90',
    exercise_type: 'ARED Resistive',
    stress_score: '3',
    mood_score: '8',
    mood_notes: '',
  });

  const filtered = healthRecords
    .filter((r) => r.astronaut_id === targetAstronautId)
    .filter((r) => sourceFilter === 'ALL' || r.data_source === sourceFilter)
    .slice(-rangeDays);

  const chartData = filtered.map((r) => ({
    date: r.recorded_at.slice(5, 10),
    hr: r.heart_rate_bpm,
    spo2: r.spo2_pct,
    sleep: r.sleep_duration_hrs,
    activity: r.activity_minutes,
    stress: r.stress_score,
    mood: r.mood_score,
    source: r.data_source,
  }));

  const handleLogHealth = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg('');
    try {
      const res = await api.createHealth({
        astronaut_id: targetAstronautId,
        heart_rate_bpm: entry.heart_rate_bpm ? Number(entry.heart_rate_bpm) : null,
        spo2_pct: entry.spo2_pct ? Number(entry.spo2_pct) : null,
        sleep_duration_hrs: entry.sleep_duration_hrs ? Number(entry.sleep_duration_hrs) : null,
        activity_minutes: entry.activity_minutes ? Number(entry.activity_minutes) : null,
        exercise_type: entry.exercise_type,
        stress_score: entry.stress_score ? Number(entry.stress_score) : null,
        mood_score: entry.mood_score ? Number(entry.mood_score) : null,
        mood_notes: entry.mood_notes,
        data_source: 'MANUAL',
      });
      await onRefresh();
      setShowAddForm(false);
      setStatusMsg(
        `Saved MANUAL measurement #${res.id}${res.missing_imputed ? ' (missing optional fields imputed from personal 14-day median)' : ''}.`
      );
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Failed to save record');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-100">Physiological & Behavioral Monitoring</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Personal time-series trends for Crew ID {targetAstronautId} · Filterable by window and provenance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#0D111A] border border-slate-800 rounded-md text-xs">
            {([7, 14, 30] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setRangeDays(d)}
                className={`px-2.5 py-1 rounded font-mono transition-colors ${
                  rangeDays === d ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {d}D
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#0D111A] border border-slate-800 rounded-md text-xs">
            {(['ALL', 'SYNTHETIC', 'MANUAL'] as const).map((src) => (
              <button
                key={src}
                type="button"
                onClick={() => setSourceFilter(src)}
                className={`px-2.5 py-1 rounded font-mono transition-colors ${
                  sourceFilter === src ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {src}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="px-3.5 py-2 text-xs font-medium bg-cyan-500 text-slate-950 rounded-md hover:bg-cyan-400 whitespace-nowrap"
          >
            {showAddForm ? 'Close Entry Form' : 'Log Manual Vitals'}
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="p-3 text-xs font-mono text-cyan-200 bg-cyan-950/30 border border-cyan-800/60 rounded-md">
          {statusMsg}
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleLogHealth} className="bg-[#0D111A] border border-cyan-500/40 rounded-lg p-5 space-y-4">
          <h3 className="font-display text-sm font-semibold text-slate-100">
            Manual Health & Mood Log (Tagged MANUAL)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Heart Rate (bpm)</label>
              <input
                type="number"
                step="0.1"
                value={entry.heart_rate_bpm}
                onChange={(e) => setEntry({ ...entry, heart_rate_bpm: e.target.value })}
                className="w-full bg-[#07090E] border border-slate-700 rounded-md px-3 py-2 font-mono text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">SpO2 (%)</label>
              <input
                type="number"
                step="0.1"
                value={entry.spo2_pct}
                onChange={(e) => setEntry({ ...entry, spo2_pct: e.target.value })}
                className="w-full bg-[#07090E] border border-slate-700 rounded-md px-3 py-2 font-mono text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Sleep Duration (hrs)</label>
              <input
                type="number"
                step="0.1"
                value={entry.sleep_duration_hrs}
                onChange={(e) => setEntry({ ...entry, sleep_duration_hrs: e.target.value })}
                className="w-full bg-[#07090E] border border-slate-700 rounded-md px-3 py-2 font-mono text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Activity (minutes)</label>
              <input
                type="number"
                value={entry.activity_minutes}
                onChange={(e) => setEntry({ ...entry, activity_minutes: e.target.value })}
                className="w-full bg-[#07090E] border border-slate-700 rounded-md px-3 py-2 font-mono text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Exercise Type</label>
              <input
                value={entry.exercise_type}
                onChange={(e) => setEntry({ ...entry, exercise_type: e.target.value })}
                className="w-full bg-[#07090E] border border-slate-700 rounded-md px-3 py-2 text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Stress Score (1-10)</label>
              <input
                type="number"
                min="1"
                max="10"
                step="0.5"
                value={entry.stress_score}
                onChange={(e) => setEntry({ ...entry, stress_score: e.target.value })}
                className="w-full bg-[#07090E] border border-slate-700 rounded-md px-3 py-2 font-mono text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Mood Score (1-10)</label>
              <input
                type="number"
                min="1"
                max="10"
                step="0.5"
                value={entry.mood_score}
                onChange={(e) => setEntry({ ...entry, mood_score: e.target.value })}
                className="w-full bg-[#07090E] border border-slate-700 rounded-md px-3 py-2 font-mono text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Notes</label>
              <input
                value={entry.mood_notes}
                onChange={(e) => setEntry({ ...entry, mood_notes: e.target.value })}
                placeholder="Optional context"
                className="w-full bg-[#07090E] border border-slate-700 rounded-md px-3 py-2 text-slate-100"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="px-4 py-2 text-xs font-medium bg-cyan-500 text-slate-950 rounded-md hover:bg-cyan-400">
              Validate & Save Entry
            </button>
          </div>
        </form>
      )}

      {chartData.length === 0 ? (
        <div className="bg-[#0D111A] border border-slate-800/90 rounded-lg p-12 text-center text-sm text-slate-400">
          No physiological records match the selected provenance filter ({sourceFilter}).
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-[#0D111A] border border-slate-800/90 rounded-lg p-5">
            <h3 className="font-display text-sm font-semibold text-slate-100 mb-3">
              Heart Rate (bpm) & SpO2 (%)
            </h3>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" stroke="#64748B" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
                  <YAxis yAxisId="hr" stroke="#06B6D4" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
                  <YAxis yAxisId="spo2" orientation="right" domain={[92, 100]} stroke="#10B981" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0B0E17', borderColor: '#1E293B', fontSize: '12px', fontFamily: 'IBM Plex Mono' }} />
                  <Line yAxisId="hr" type="monotone" dataKey="hr" name="Heart Rate (bpm)" stroke="#06B6D4" strokeWidth={2} dot={{ r: 2 }} />
                  <Line yAxisId="spo2" type="monotone" dataKey="spo2" name="SpO2 (%)" stroke="#10B981" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="bg-[#0D111A] border border-slate-800/90 rounded-lg p-5">
            <h3 className="font-display text-sm font-semibold text-slate-100 mb-3">
              Sleep Duration (hrs)
            </h3>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" stroke="#64748B" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
                  <YAxis domain={[0, 10]} stroke="#F59E0B" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0B0E17', borderColor: '#1E293B', fontSize: '12px', fontFamily: 'IBM Plex Mono' }} />
                  <Area type="monotone" dataKey="sleep" name="Sleep (hrs)" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.14} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="bg-[#0D111A] border border-slate-800/90 rounded-lg p-5">
            <h3 className="font-display text-sm font-semibold text-slate-100 mb-3">
              Physical Countermeasure Activity (min/day)
            </h3>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" stroke="#64748B" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
                  <YAxis stroke="#64748B" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0B0E17', borderColor: '#1E293B', fontSize: '12px', fontFamily: 'IBM Plex Mono' }} />
                  <Bar dataKey="activity" name="Activity (min)" fill="#06B6D4" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="bg-[#0D111A] border border-slate-800/90 rounded-lg p-5">
            <h3 className="font-display text-sm font-semibold text-slate-100 mb-3">
              Subjective Stress & Mood Logs (1–10 Scale)
            </h3>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" stroke="#64748B" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
                  <YAxis domain={[1, 10]} stroke="#64748B" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0B0E17', borderColor: '#1E293B', fontSize: '12px', fontFamily: 'IBM Plex Mono' }} />
                  <Line type="monotone" dataKey="mood" name="Mood (1-10)" stroke="#10B981" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="stress" name="Stress (1-10)" stroke="#F43F5E" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}

      {/* Historical Comparison Table */}
      <section className="bg-[#0D111A] border border-slate-800/90 rounded-lg p-5 overflow-x-auto">
        <h3 className="font-display text-sm font-semibold text-slate-100 mb-3">
          Telemetry Ledger ({filtered.length} records)
        </h3>
        <table className="w-full text-xs text-left">
          <thead className="text-slate-400 border-b border-slate-800 font-mono">
            <tr>
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Source</th>
              <th className="py-2 pr-4 text-right">HR (bpm)</th>
              <th className="py-2 pr-4 text-right">SpO2 (%)</th>
              <th className="py-2 pr-4 text-right">Sleep (h)</th>
              <th className="py-2 pr-4 text-right">Activity (m)</th>
              <th className="py-2 pr-4 text-right">Stress / Mood</th>
              <th className="py-2">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
            {filtered.slice(-12).reverse().map((r) => (
              <tr key={r.id} className="hover:bg-slate-800/30">
                <td className="py-2 pr-4 text-slate-300">{r.recorded_at.slice(0, 10)}</td>
                <td className={`py-2 pr-4 ${r.data_source === 'SYNTHETIC' ? 'text-amber-300' : 'text-cyan-300'}`}>
                  {r.data_source}{r.missing_imputed ? ' (Imputed)' : ''}
                </td>
                <td className="py-2 pr-4 text-right text-slate-200">{r.heart_rate_bpm ?? '--'}</td>
                <td className="py-2 pr-4 text-right text-slate-200">{r.spo2_pct ?? '--'}</td>
                <td className="py-2 pr-4 text-right text-slate-200">{r.sleep_duration_hrs ?? '--'}</td>
                <td className="py-2 pr-4 text-right text-slate-200">{r.activity_minutes ?? '--'}</td>
                <td className="py-2 pr-4 text-right text-slate-200">
                  {r.stress_score ?? '--'} / {r.mood_score ?? '--'}
                </td>
                <td className="py-2 font-sans text-slate-400 max-w-xs truncate">{r.mood_notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
};
