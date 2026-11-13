import React, { useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../services/apiAdapter';
import type { EnvironmentalRecord } from '../types/domain';

interface EnvironmentPageProps {
  envRecords: EnvironmentalRecord[];
  onRefresh: () => Promise<void>;
}

export const EnvironmentPage: React.FC<EnvironmentPageProps> = ({ envRecords, onRefresh }) => {
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    habitat_zone: 'Crew Quarters & Medical Bay',
    radiation_msv_day: '0.64',
    cabin_co2_ppm: '2180',
    oxygen_pct: '20.9',
    temperature_c: '22.2',
    humidity_pct: '45.0',
    pressure_kpa: '101.3',
  });

  const latest = envRecords[envRecords.length - 1] || null;
  const chartRows = envRecords.slice(-30).map((e) => ({
    date: e.recorded_at.slice(5, 10),
    radiation: e.radiation_msv_day,
    co2: e.cabin_co2_ppm,
    o2: e.oxygen_pct,
    temp: e.temperature_c,
    humidity: e.humidity_pct,
    pressure: e.pressure_kpa,
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createEnvironment({
        mission_name: 'ARTEMIS-SIM-04',
        habitat_zone: form.habitat_zone,
        radiation_msv_day: Number(form.radiation_msv_day),
        cabin_co2_ppm: Number(form.cabin_co2_ppm),
        oxygen_pct: Number(form.oxygen_pct),
        temperature_c: Number(form.temperature_c),
        humidity_pct: Number(form.humidity_pct),
        pressure_kpa: Number(form.pressure_kpa),
        data_source: 'MANUAL',
      });
      await onRefresh();
      setShowForm(false);
      setMsg('Saved MANUAL environmental telemetry reading.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Save failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-100">Habitat & Spacecraft Environment</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Closed-loop atmosphere and dosimetry channels modeled after NASA OSDR EDA telemetry schemas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="px-3.5 py-2 text-xs font-medium bg-cyan-500 text-slate-950 rounded-md hover:bg-cyan-400 whitespace-nowrap"
        >
          {showForm ? 'Close Form' : 'Log ECLSS Reading'}
        </button>
      </div>

      {msg && (
        <div className="p-3 text-xs font-mono text-cyan-200 bg-cyan-950/30 border border-cyan-800/60 rounded-md">
          {msg}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-[#0D111A] border border-cyan-500/40 rounded-lg p-5 space-y-4">
          <h3 className="font-display text-sm font-semibold text-slate-100">Manual Habitat Telemetry Entry</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Radiation (mSv/d)</label>
              <input type="number" step="0.01" value={form.radiation_msv_day} onChange={(e) => setForm({ ...form, radiation_msv_day: e.target.value })} className="w-full bg-[#07090E] border border-slate-700 rounded-md px-3 py-2 font-mono text-slate-100" />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Cabin CO2 (ppm)</label>
              <input type="number" step="10" value={form.cabin_co2_ppm} onChange={(e) => setForm({ ...form, cabin_co2_ppm: e.target.value })} className="w-full bg-[#07090E] border border-slate-700 rounded-md px-3 py-2 font-mono text-slate-100" />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Oxygen (%)</label>
              <input type="number" step="0.1" value={form.oxygen_pct} onChange={(e) => setForm({ ...form, oxygen_pct: e.target.value })} className="w-full bg-[#07090E] border border-slate-700 rounded-md px-3 py-2 font-mono text-slate-100" />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Temp (°C)</label>
              <input type="number" step="0.1" value={form.temperature_c} onChange={(e) => setForm({ ...form, temperature_c: e.target.value })} className="w-full bg-[#07090E] border border-slate-700 rounded-md px-3 py-2 font-mono text-slate-100" />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Humidity (%)</label>
              <input type="number" step="0.5" value={form.humidity_pct} onChange={(e) => setForm({ ...form, humidity_pct: e.target.value })} className="w-full bg-[#07090E] border border-slate-700 rounded-md px-3 py-2 font-mono text-slate-100" />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Pressure (kPa)</label>
              <input type="number" step="0.1" value={form.pressure_kpa} onChange={(e) => setForm({ ...form, pressure_kpa: e.target.value })} className="w-full bg-[#07090E] border border-slate-700 rounded-md px-3 py-2 font-mono text-slate-100" />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="px-4 py-2 text-xs font-medium bg-cyan-500 text-slate-950 rounded-md hover:bg-cyan-400">
              Save Environmental Reading
            </button>
          </div>
        </form>
      )}

      {/* 6 Calibrated Metric Readouts */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Radiation Dose', val: latest?.radiation_msv_day ?? '--', unit: 'mSv/d' },
          { label: 'Cabin CO2', val: latest?.cabin_co2_ppm ?? '--', unit: 'ppm' },
          { label: 'Oxygen Level', val: latest?.oxygen_pct ?? '--', unit: '%' },
          { label: 'Temperature', val: latest?.temperature_c ?? '--', unit: '°C' },
          { label: 'Rel. Humidity', val: latest?.humidity_pct ?? '--', unit: '%' },
          { label: 'Cabin Pressure', val: latest?.pressure_kpa ?? '--', unit: 'kPa' },
        ].map((m) => (
          <div key={m.label} className="bg-[#0D111A] border border-slate-800/90 rounded-lg p-4">
            <div className="text-xs text-slate-400">{m.label}</div>
            <div className="text-2xl font-mono font-semibold text-slate-100 mt-1 tabular-nums">
              {m.val}
              <span className="text-xs text-slate-400 ml-1">{m.unit}</span>
            </div>
            <div className="text-[11px] font-mono text-slate-500 mt-1">
              {latest?.data_source || 'N/A'}
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-[#0D111A] border border-slate-800/90 rounded-lg p-5">
          <h3 className="font-display text-sm font-semibold text-slate-100 mb-3">
            Radiation Exposure (mSv/day)
          </h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartRows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" stroke="#64748B" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
                <YAxis stroke="#F43F5E" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
                <Tooltip contentStyle={{ backgroundColor: '#0B0E17', borderColor: '#1E293B', fontSize: '12px', fontFamily: 'IBM Plex Mono' }} />
                <Area type="monotone" dataKey="radiation" name="Radiation (mSv/d)" stroke="#F43F5E" fill="#F43F5E" fillOpacity={0.16} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-[#0D111A] border border-slate-800/90 rounded-lg p-5">
          <h3 className="font-display text-sm font-semibold text-slate-100 mb-3">
            Cabin CO2 Concentration (ppm)
          </h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartRows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" stroke="#64748B" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
                <YAxis stroke="#F59E0B" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
                <Tooltip contentStyle={{ backgroundColor: '#0B0E17', borderColor: '#1E293B', fontSize: '12px', fontFamily: 'IBM Plex Mono' }} />
                <Line type="monotone" dataKey="co2" name="CO2 (ppm)" stroke="#F59E0B" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-[#0D111A] border border-slate-800/90 rounded-lg p-5">
          <h3 className="font-display text-sm font-semibold text-slate-100 mb-3">
            Oxygen (%) & Pressure (kPa)
          </h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartRows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" stroke="#64748B" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
                <YAxis yAxisId="o2" domain={[19, 23]} stroke="#10B981" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
                <YAxis yAxisId="kpa" orientation="right" domain={[98, 104]} stroke="#06B6D4" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
                <Tooltip contentStyle={{ backgroundColor: '#0B0E17', borderColor: '#1E293B', fontSize: '12px', fontFamily: 'IBM Plex Mono' }} />
                <Line yAxisId="o2" type="monotone" dataKey="o2" name="O2 (%)" stroke="#10B981" strokeWidth={2} dot={false} />
                <Line yAxisId="kpa" type="monotone" dataKey="pressure" name="Pressure (kPa)" stroke="#06B6D4" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-[#0D111A] border border-slate-800/90 rounded-lg p-5">
          <h3 className="font-display text-sm font-semibold text-slate-100 mb-3">
            Temperature (°C) & Relative Humidity (%)
          </h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartRows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" stroke="#64748B" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
                <YAxis yAxisId="t" domain={[18, 28]} stroke="#06B6D4" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
                <YAxis yAxisId="h" orientation="right" domain={[30, 70]} stroke="#94A3B8" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
                <Tooltip contentStyle={{ backgroundColor: '#0B0E17', borderColor: '#1E293B', fontSize: '12px', fontFamily: 'IBM Plex Mono' }} />
                <Line yAxisId="t" type="monotone" dataKey="temp" name="Temp (°C)" stroke="#06B6D4" strokeWidth={2} dot={false} />
                <Line yAxisId="h" type="monotone" dataKey="humidity" name="Humidity (%)" stroke="#94A3B8" strokeWidth={2} strokeDasharray="4 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
};
