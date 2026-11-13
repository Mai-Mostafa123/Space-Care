import React, { useEffect, useState } from 'react';
import { api } from '../services/apiAdapter';
import type { DatasetEntry } from '../types/domain';

export const TransparencyPage: React.FC = () => {
  const [datasets, setDatasets] = useState<DatasetEntry[]>([]);
  const [filterClass, setFilterClass] = useState<'ALL' | 'REAL' | 'SIMULATED' | 'MANUAL'>('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listDatasets()
      .then((res) => setDatasets(res.datasets))
      .catch(() => setDatasets([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = datasets.filter(
    (d) => filterClass === 'ALL' || d.source_classification === filterClass
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-100">
            Data Provenance & Dataset Transparency Registry
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Strict separation between verified NASA open science catalogs (REAL), deterministic test benchmarks (SIMULATED / SYNTHETIC), and crew entries (MANUAL).
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#0D111A] border border-slate-800 rounded-md text-xs">
          {(['ALL', 'REAL', 'SIMULATED', 'MANUAL'] as const).map((cls) => (
            <button
              key={cls}
              type="button"
              onClick={() => setFilterClass(cls)}
              className={`px-3 py-1.5 rounded font-mono transition-colors ${
                filterClass === cls ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {cls}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="bg-[#0D111A] border border-slate-800 rounded-lg p-10 text-center text-sm text-slate-400">
          Loading verified dataset registry...
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((ds) => (
            <article key={ds.dataset_identifier} className="bg-[#0D111A] border border-slate-800/90 rounded-lg p-5 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span
                      className={
                        ds.source_classification === 'REAL'
                          ? 'text-emerald-400 font-semibold'
                          : ds.source_classification === 'SIMULATED'
                          ? 'text-amber-300 font-semibold'
                          : 'text-cyan-300 font-semibold'
                      }
                    >
                      {ds.source_classification}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-300">{ds.dataset_identifier}</span>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-400">{ds.time_coverage}</span>
                  </div>
                  <h3 className="font-display text-base font-semibold text-slate-100 mt-1">
                    {ds.name}
                  </h3>
                  <div className="text-xs text-slate-400 mt-0.5">{ds.original_source}</div>
                </div>

                <div className="text-xs font-mono text-slate-400 text-right">
                  <div>{ds.file_format}</div>
                  <div className="text-slate-500 mt-0.5">{ds.record_count}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
                <div className="lg:col-span-5 space-y-1.5">
                  <div className="text-slate-400 font-medium">Available Variables</div>
                  <div className="text-slate-300 font-mono text-[11px] leading-relaxed">
                    {ds.variables.join(' · ')}
                  </div>
                  <div className="text-slate-400 font-medium pt-2">Accessibility & API Method</div>
                  <div className="text-slate-300">{ds.accessibility}</div>
                  <div className="font-mono text-[11px] text-cyan-300 break-all">{ds.download_or_api_method}</div>
                </div>

                <div className="lg:col-span-7 space-y-2">
                  <div>
                    <span className="text-slate-400 font-medium block">Relevance to Astronaut Monitoring</span>
                    <p className="text-slate-300 mt-0.5 leading-relaxed">{ds.relevance_notes}</p>
                  </div>
                  <div>
                    <span className="text-amber-300 font-medium block">Known Limitations</span>
                    <p className="text-slate-400 mt-0.5 leading-relaxed">{ds.limitations}</p>
                  </div>
                  <div className="text-[11px] text-slate-500">License: {ds.license_info}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
