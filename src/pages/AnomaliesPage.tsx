import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../services/apiAdapter';
import type { AnomalyAlert, MLEvaluationMetrics } from '../types/domain';

interface AnomaliesPageProps {
  anomalies: AnomalyAlert[];
  selectedAstronautId: number | null;
  onRefresh: () => Promise<void>;
}

export const AnomaliesPage: React.FC<AnomaliesPageProps> = ({
  anomalies,
  selectedAstronautId,
  onRefresh,
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED'>('ALL');
  const [evalMetrics, setEvalMetrics] = useState<MLEvaluationMetrics | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    api.getMLEvaluation().then(setEvalMetrics).catch(() => setEvalMetrics(null));
  }, []);

  const filtered = anomalies
    .filter((a) => !selectedAstronautId || a.astronaut_id === selectedAstronautId)
    .filter((a) => statusFilter === 'ALL' || a.status === statusFilter);

  const handleScan = async () => {
    setScanning(true);
    try {
      await api.runAnomalyDetectionAll();
      await onRefresh();
    } finally {
      setScanning(false);
    }
  };

  const handleUpdateStatus = async (id: number, status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED') => {
    await api.updateAnomalyStatus(id, status);
    await onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-100">
            Personal-Baseline Anomaly Detection
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Compares each astronaut against their own rolling baseline and multivariable joint distribution — never population diagnostic cutoffs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#0D111A] border border-slate-800 rounded-md text-xs">
            {(['ALL', 'ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded font-mono transition-colors ${
                  statusFilter === st ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleScan}
            disabled={scanning}
            className="px-3.5 py-2 text-xs font-medium bg-cyan-500 text-slate-950 rounded-md hover:bg-cyan-400 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
            <span>{scanning ? 'Scanning...' : 'Run Baseline Scan'}</span>
          </button>
        </div>
      </div>

      {/* Synthetic Benchmark Model Evaluation Strip */}
      {evalMetrics && (
        <section className="bg-[#0D111A] border border-slate-800/90 rounded-lg p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="font-display text-sm font-semibold text-slate-100">
                Model Evaluation · {evalMetrics.evaluation_scope}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Quantitative performance on labeled synthetic perturbations ({evalMetrics.total_samples} daily crew observations, {evalMetrics.positive_ground_truth} positive anomalies).
              </p>
            </div>
            <span className="text-xs font-mono text-amber-300">
              Synthetic Benchmark Only
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block">Precision</span>
              <span className="text-xl font-mono font-semibold text-slate-100 tabular-nums">
                {(evalMetrics.precision * 100).toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Recall</span>
              <span className="text-xl font-mono font-semibold text-slate-100 tabular-nums">
                {(evalMetrics.recall * 100).toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">F1-Score</span>
              <span className="text-xl font-mono font-semibold text-cyan-300 tabular-nums">
                {(evalMetrics.f1_score * 100).toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">False Positive Rate</span>
              <span className="text-xl font-mono font-semibold text-slate-100 tabular-nums">
                {(evalMetrics.false_positive_rate * 100).toFixed(2)}%
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Confusion Matrix (TP/FP/FN/TN)</span>
              <span className="text-sm font-mono font-semibold text-slate-200 mt-1 block tabular-nums">
                {evalMetrics.confusion_matrix.tp} / {evalMetrics.confusion_matrix.fp} / {evalMetrics.confusion_matrix.fn} / {evalMetrics.confusion_matrix.tn}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Alerts List */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="bg-[#0D111A] border border-slate-800/90 rounded-lg p-12 text-center text-sm text-slate-400">
            No anomaly alerts matching filter ({statusFilter}).
          </div>
        ) : (
          filtered.map((alert) => (
            <article key={alert.id} className="bg-[#0D111A] border border-slate-800/90 rounded-lg p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800/80 pb-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                    <span
                      className={
                        alert.severity_tier === 'CRITICAL_REVIEW'
                          ? 'text-rose-400 font-semibold'
                          : alert.severity_tier === 'ELEVATED'
                          ? 'text-amber-400 font-semibold'
                          : 'text-cyan-400 font-semibold'
                      }
                    >
                      {alert.severity_tier}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-200">{alert.call_sign || `Crew #${alert.astronaut_id}`}</span>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-400">{alert.detected_at.slice(0, 10)}</span>
                    <span className="text-slate-600">·</span>
                    <span className="text-amber-300">Source: {alert.data_source}</span>
                  </div>
                  <h3 className="font-display text-base font-semibold text-slate-100 mt-1">
                    {alert.variables_involved}
                  </h3>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-slate-400 mr-2">
                    Score {alert.anomaly_score.toFixed(2)} · {alert.confidence_level}
                  </span>
                  {alert.status !== 'ACKNOWLEDGED' && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(alert.id, 'ACKNOWLEDGED')}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md"
                    >
                      Acknowledge
                    </button>
                  )}
                  {alert.status !== 'RESOLVED' && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(alert.id, 'RESOLVED')}
                      className="px-3 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 rounded-md"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
                <div className="lg:col-span-7 space-y-2">
                  <div className="text-slate-400 font-medium">Explainable Deviation Summary ({alert.detection_method})</div>
                  <p className="text-slate-200 leading-relaxed">{alert.explanation}</p>
                  <p className="text-slate-400 leading-relaxed pt-1 border-t border-slate-800/70">
                    {alert.uncertainty_statement}
                  </p>
                </div>

                <div className="lg:col-span-5 bg-[#07090E] border border-slate-800/80 rounded-md p-3 font-mono space-y-1.5">
                  <div className="text-slate-400 text-[11px]">Observed vs. Personal Baseline Reference</div>
                  {Object.entries(alert.observed_values).map(([k, val]) => {
                    const base = alert.baseline_reference[k];
                    return (
                      <div key={k} className="flex items-center justify-between text-xs tabular-nums">
                        <span className="text-slate-300">{k}</span>
                        <span className="text-cyan-300">
                          {val}
                          {base ? ` (base ${base.mean} ± ${base.std})` : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
};
