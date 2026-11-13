import fs from 'node:fs';
import path from 'node:path';
import { db } from './db.js';

export const MANDATORY_UNCERTAINTY_STATEMENT =
  "Decision-support statistical notice: This alert reflects deviation from this astronaut's own historical baseline rather than a clinical threshold or medical diagnosis. Sensor artifacts, recent EVA workload, or environmental telemetry lags can influence scores; verify raw vitals and habitat ECLSS readings before action.";

interface HealthRow {
  id: number;
  astronaut_id: number;
  recorded_at: string;
  heart_rate_bpm: number;
  spo2_pct: number;
  sleep_duration_hrs: number;
  stress_score: number;
  mood_score: number;
  activity_minutes: number;
  data_source: string;
}

interface EnvRow {
  recorded_at: string;
  cabin_co2_ppm: number;
  radiation_msv_day: number;
}

function statsFor(values: number[]) {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / Math.max(1, n);
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1);
  const std = Math.max(Math.sqrt(variance), 0.35);
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(n * 0.25)] ?? mean;
  const q3 = sorted[Math.floor(n * 0.75)] ?? mean;
  return {
    mean: Number(mean.toFixed(2)),
    median: Number((sorted[Math.floor(n / 2)] ?? mean).toFixed(2)),
    std: Number(std.toFixed(2)),
    iqr_low: Number((q1 - 1.5 * (q3 - q1)).toFixed(2)),
    iqr_high: Number((q3 + 1.5 * (q3 - q1)).toFixed(2)),
    n_samples: n,
  };
}

export function runAnomalyDetectionForAstronaut(astronautId: number, persistAlerts = true) {
  const astro = db.prepare('SELECT * FROM astronauts WHERE id = ?').get(astronautId) as
    | { id: number; call_sign: string; mission_name: string }
    | undefined;
  if (!astro) {
    return { error: `Astronaut ${astronautId} not found`, alerts_detected: 0 };
  }

  const records = db
    .prepare('SELECT * FROM health_records WHERE astronaut_id = ? ORDER BY recorded_at ASC')
    .all(astronautId) as unknown as HealthRow[];

  if (records.length < 7) {
    return {
      astronaut_id: astronautId,
      call_sign: astro.call_sign,
      samples_analyzed: records.length,
      baseline: {},
      alerts_detected: 0,
      uncertainty_note: `Insufficient personal history (${records.length} records; minimum 7 required for rolling baseline).`,
    };
  }

  const envRecords = db
    .prepare('SELECT recorded_at, cabin_co2_ppm, radiation_msv_day FROM environmental_records WHERE mission_name = ? ORDER BY recorded_at ASC')
    .all(astro.mission_name) as unknown as EnvRow[];

  const envByDate = new Map<string, EnvRow>();
  for (const e of envRecords) {
    envByDate.set(e.recorded_at.slice(0, 10), e);
  }

  const baselineCount = Math.max(7, Math.min(12, Math.floor(records.length * 0.5)));
  const baseSlice = records.slice(0, baselineCount);

  const baseline = {
    heart_rate_bpm: statsFor(baseSlice.map((r) => r.heart_rate_bpm).filter((v) => v != null)),
    spo2_pct: statsFor(baseSlice.map((r) => r.spo2_pct).filter((v) => v != null)),
    sleep_duration_hrs: statsFor(baseSlice.map((r) => r.sleep_duration_hrs).filter((v) => v != null)),
    stress_score: statsFor(baseSlice.map((r) => r.stress_score).filter((v) => v != null)),
    mood_score: statsFor(baseSlice.map((r) => r.mood_score).filter((v) => v != null)),
    activity_minutes: statsFor(baseSlice.map((r) => r.activity_minutes).filter((v) => v != null)),
  };

  if (persistAlerts) {
    db.prepare("DELETE FROM anomaly_alerts WHERE astronaut_id = ? AND status = 'ACTIVE'").run(astronautId);
  }

  const insertStmt = db.prepare(`
    INSERT INTO anomaly_alerts (
      astronaut_id, detected_at, variables_involved, observed_values_json,
      baseline_reference_json, deviation_description, detection_method,
      anomaly_score, confidence_level, severity_tier, status, data_source,
      explanation, uncertainty_statement
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)
  `);

  let detectedCount = 0;

  for (const row of records) {
    const checks: Array<{ key: keyof typeof baseline; unit: string; zThresh: number }> = [
      { key: 'heart_rate_bpm', unit: 'bpm', zThresh: 2.1 },
      { key: 'spo2_pct', unit: '%', zThresh: 2.0 },
      { key: 'sleep_duration_hrs', unit: 'hrs', zThresh: 2.0 },
      { key: 'stress_score', unit: '/10', zThresh: 2.1 },
      { key: 'mood_score', unit: '/10', zThresh: 2.1 },
    ];

    const deviatingVars: string[] = [];
    const observedMap: Record<string, number> = {};
    const baselineMap: Record<string, unknown> = {};
    const devParts: string[] = [];
    let zSumSq = 0;

    for (const c of checks) {
      const val = row[c.key];
      const ref = baseline[c.key];
      if (val == null || !ref) continue;
      const z = (val - ref.mean) / Math.max(ref.std, 0.35);
      zSumSq += z * z;
      if (Math.abs(z) >= c.zThresh) {
        deviatingVars.push(c.key);
        observedMap[c.key] = Number(val.toFixed(2));
        baselineMap[c.key] = ref;
        const dir = z > 0 ? 'above' : 'below';
        devParts.push(`${c.key}: ${val.toFixed(2)}${c.unit} (${Math.abs(z).toFixed(1)}σ ${dir} personal baseline ${ref.mean}${c.unit})`);
      }
    }

    const envMatch = envByDate.get(row.recorded_at.slice(0, 10));
    const multiDist = Math.sqrt(zSumSq / checks.length);
    const normScore = Number(Math.min(0.99, Math.max(0.05, multiDist / 4.2)).toFixed(3));

    if (deviatingVars.length > 0 || normScore >= 0.65) {
      if (envMatch && envMatch.cabin_co2_ppm > 3500) {
        observedMap.cabin_co2_ppm = envMatch.cabin_co2_ppm;
        devParts.push(`Co-occurring elevated cabin CO2 (${envMatch.cabin_co2_ppm} ppm)`);
      }
      const method = deviatingVars.length >= 2 ? 'MULTIVARIATE_BASELINE_DISTANCE' : 'PERSONAL_ZSCORE_ROLLING';
      const severity =
        deviatingVars.length >= 3 || normScore > 0.78
          ? 'CRITICAL_REVIEW'
          : deviatingVars.length >= 2
          ? 'ELEVATED'
          : 'ADVISORY';
      const confidence = records.length >= 20 ? 'HIGH' : 'MODERATE';
      const explanation = `Detected ${method.replace(/_/g, ' ').toLowerCase()} deviation for ${astro.call_sign} on ${row.recorded_at.slice(0, 10)}. Contributing signals: ${devParts.join('; ')}.`;

      if (persistAlerts) {
        insertStmt.run(
          astronautId,
          row.recorded_at,
          deviatingVars.join(', ') || 'multivariate_profile',
          JSON.stringify(observedMap),
          JSON.stringify(baselineMap),
          devParts.join('; '),
          method,
          normScore,
          confidence,
          severity,
          row.data_source,
          explanation,
          MANDATORY_UNCERTAINTY_STATEMENT
        );
      }
      detectedCount += 1;
    }
  }

  return {
    astronaut_id: astronautId,
    call_sign: astro.call_sign,
    samples_analyzed: records.length,
    baseline,
    alerts_detected: detectedCount,
  };
}

export function evaluateSyntheticBenchmark() {
  const synthPath = path.resolve(process.cwd(), 'data', 'synthetic', 'synthetic_benchmark_30d.json');
  const payload = JSON.parse(fs.readFileSync(synthPath, 'utf-8')) as {
    health_records: Array<HealthRow & { call_sign: string; synthetic_ground_truth_anomaly: boolean }>;
  };

  const byCrew = new Map<string, typeof payload.health_records>();
  for (const r of payload.health_records) {
    const arr = byCrew.get(r.call_sign) || [];
    arr.push(r);
    byCrew.set(r.call_sign, arr);
  }

  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;

  for (const [, rows] of byCrew) {
    rows.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
    // Leakage-free split: Days 1-12 clean baseline, Days 13-30 out-of-sample evaluation
    const baseSlice = rows.slice(0, 12);
    const evalSlice = rows.slice(12);
    const baseline = {
      heart_rate_bpm: statsFor(baseSlice.map((r) => r.heart_rate_bpm)),
      spo2_pct: statsFor(baseSlice.map((r) => r.spo2_pct)),
      sleep_duration_hrs: statsFor(baseSlice.map((r) => r.sleep_duration_hrs)),
      stress_score: statsFor(baseSlice.map((r) => r.stress_score)),
    };

    for (const r of evalSlice) {
      let hits = 0;
      const checks: Array<[keyof typeof baseline, number]> = [
        ['heart_rate_bpm', 2.1],
        ['spo2_pct', 2.0],
        ['sleep_duration_hrs', 2.0],
        ['stress_score', 2.1],
      ];
      for (const [k, t] of checks) {
        const ref = baseline[k];
        if (Math.abs((r[k] - ref.mean) / Math.max(ref.std, 0.35)) >= t) {
          hits += 1;
        }
      }
      const pred = hits >= 2;
      const truth = Boolean(r.synthetic_ground_truth_anomaly);
      if (truth && pred) tp += 1;
      else if (!truth && pred) fp += 1;
      else if (truth && !pred) fn += 1;
      else tn += 1;
    }
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const fpr = fp + tn > 0 ? fp / (fp + tn) : 0;

  return {
    evaluation_scope: 'SYNTHETIC_BENCHMARK_OUT_OF_SAMPLE (AEGIS-SYNTH-30D Days 13-30)',
    total_samples: tp + fp + fn + tn,
    positive_ground_truth: tp + fn,
    precision: Number(precision.toFixed(4)),
    recall: Number(recall.toFixed(4)),
    f1_score: Number(f1.toFixed(4)),
    false_positive_rate: Number(fpr.toFixed(4)),
    confusion_matrix: { tp, fp, fn, tn },
  };
}
