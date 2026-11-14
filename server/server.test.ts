// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { extractStructuredFromTranscript } from './voice.ts';
import { evaluateSyntheticBenchmark } from './ml.ts';
import { createApp } from '../server.ts';

describe('Aegis Orbital Health — Full Audit API, ML, Security, Voice & RAG Suite', () => {
  it('extracts structured health & profile fields from voice transcripts and requires confirmation', () => {
    const res = extractStructuredFromTranscript(
      'Heart rate is 72, SpO2 98.5, slept 7.4 hours, exercise 60 minutes, stress level 3, mood 8.',
      'health_log'
    );
    expect(res.requires_confirmation).toBe(true);
    expect(res.validation_passed).toBe(true);
    expect(res.extracted_fields.heart_rate_bpm).toBe(72);
    expect(res.extracted_fields.spo2_pct).toBe(98.5);
    expect(res.extracted_fields.sleep_duration_hrs).toBe(7.4);

    const prof = extractStructuredFromTranscript(
      'Update mission day 24 role Flight Surgeon mission ARTEMIS-SIM-04 notes baseline stable',
      'profile_update'
    );
    expect(prof.requires_confirmation).toBe(true);
    expect(prof.validation_passed).toBe(true);
    expect(prof.extracted_fields.mission_day).toBe(24);
  });

  it('rejects out-of-range physiological values during voice extraction', () => {
    const res = extractStructuredFromTranscript('Heart rate is 450, SpO2 40', 'health_log');
    expect(res.validation_passed).toBe(false);
    expect(res.transcription_errors.length).toBeGreaterThanOrEqual(2);
  });

  it('evaluates ML anomaly detector strictly out-of-sample on AEGIS-SYNTH-30D Days 13-30', () => {
    const metrics = evaluateSyntheticBenchmark();
    expect(metrics.evaluation_scope).toContain('OUT_OF_SAMPLE');
    expect(metrics.total_samples).toBe(54);
    expect(metrics.positive_ground_truth).toBe(6);
    expect(metrics.f1_score).toBeGreaterThanOrEqual(0.75);
  });

  it('enforces validation, security headers, profile isolation, reactive anomaly detection, persistence, and grounded RAG across all endpoints', async () => {
    const app = createApp();
    const server = app.listen(0);
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 3001;
    const base = `http://127.0.0.1:${port}`;

    try {
      // System status & security headers
      const sysRes = await fetch(`${base}/api/system/status`);
      expect(sysRes.status).toBe(200);
      expect(sysRes.headers.get('x-powered-by')).toBeNull();
      expect(sysRes.headers.get('x-content-type-options')).toBe('nosniff');
      expect(sysRes.headers.get('referrer-policy')).toBe('no-referrer');
      const sysJson = await sysRes.json();
      expect(sysJson.database_connected).toBe(true);
      expect(sysJson.counts.astronauts).toBeGreaterThanOrEqual(3);

      // Malformed JSON and invalid ID rejection
      const badJsonRes = await fetch(`${base}/api/astronauts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{bad-json',
      });
      expect(badJsonRes.status).toBe(400);
      expect((await badJsonRes.json()).detail).toBe('Malformed JSON request payload.');

      const badIdRes = await fetch(`${base}/api/astronauts/not-an-id`);
      expect(badIdRes.status).toBe(400);

      const badDetectId = await fetch(`${base}/api/anomalies/detect/abc`, { method: 'POST' });
      expect(badDetectId.status).toBe(400);

      // Invalid environmental bounds -> 422
      const badEnvRes = await fetch(`${base}/api/environment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          radiation_msv_day: -5,
          cabin_co2_ppm: 99999,
          oxygen_pct: 20.9,
          temperature_c: 22,
          humidity_pct: 45,
          pressure_kpa: 101.3,
        }),
      });
      expect(badEnvRes.status).toBe(422);

      // Create isolated test astronaut
      const uniqueCallSign = `VIT-${Date.now().toString().slice(-4)}`;
      const createRes = await fetch(`${base}/api/astronauts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_sign: uniqueCallSign,
          full_name: 'Vitest Operator',
          role: 'Payload Officer',
          mission_name: 'ARTEMIS-SIM-04',
          data_source: 'MANUAL',
        }),
      });
      expect(createRes.status).toBe(201);
      const created = await createRes.json();
      expect(created.data_source).toBe('MANUAL');

      const updateRes = await fetch(`${base}/api/astronauts/${created.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mission_day: 12 }),
      });
      expect(updateRes.status).toBe(200);
      expect((await updateRes.json()).mission_day).toBe(12);

      // Invalid health bounds -> 422
      const badHealth = await fetch(`${base}/api/health`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ astronaut_id: created.id, heart_rate_bpm: 450 }),
      });
      expect(badHealth.status).toBe(422);

      // Insert 7 clean baseline records + 1 strong deviation -> reactive ML alert for created astronaut ONLY
      for (let d = 1; d <= 7; d++) {
        const okRes = await fetch(`${base}/api/health`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            astronaut_id: created.id,
            recorded_at: `2026-02-${String(d).padStart(2, '0')}T08:00:00Z`,
            heart_rate_bpm: 62 + (d % 2),
            spo2_pct: 98.5,
            sleep_duration_hrs: 7.5,
            activity_minutes: 90,
            stress_score: 2.5,
            mood_score: 8.5,
            data_source: 'MANUAL',
          }),
        });
        expect(okRes.status).toBe(201);
      }

      const spikeRes = await fetch(`${base}/api/health`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          astronaut_id: created.id,
          recorded_at: '2026-02-08T08:00:00Z',
          heart_rate_bpm: 112,
          spo2_pct: 91.5,
          sleep_duration_hrs: 3.4,
          activity_minutes: 15,
          stress_score: 9.0,
          mood_score: 3.0,
          data_source: 'MANUAL',
        }),
      });
      expect(spikeRes.status).toBe(201);
      const spikeJson = await spikeRes.json();
      expect(spikeJson.alerts_detected).toBeGreaterThanOrEqual(1);

      // Profile isolation check: verify new alerts belong exclusively to created.id
      const newAlertsRes = await fetch(`${base}/api/anomalies?astronaut_id=${created.id}`);
      const newAlerts = await newAlertsRes.json();
      expect(newAlerts.length).toBeGreaterThanOrEqual(1);
      expect(newAlerts.every((a: { astronaut_id: number }) => a.astronaut_id === created.id)).toBe(true);

      // Alert status transitions (ACKNOWLEDGE -> ACTIVE clears acknowledged_at)
      const alertId = newAlerts[0].id;
      const ackRes = await fetch(`${base}/api/anomalies/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACKNOWLEDGED' }),
      });
      expect(ackRes.status).toBe(200);
      expect((await ackRes.json()).acknowledged_at).toBeTruthy();

      const reopenRes = await fetch(`${base}/api/anomalies/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACTIVE' }),
      });
      expect(reopenRes.status).toBe(200);
      expect((await reopenRes.json()).acknowledged_at).toBeNull();

      // Persistence check across new Express app instance
      const app2 = createApp();
      const server2 = app2.listen(0);
      const addr2 = server2.address();
      const port2 = typeof addr2 === 'object' && addr2 ? addr2.port : 3002;
      try {
        const persistedRes = await fetch(`http://127.0.0.1:${port2}/api/astronauts/${created.id}`);
        expect(persistedRes.status).toBe(200);
        const persisted = await persistedRes.json();
        expect(persisted.profile.call_sign).toBe(uniqueCallSign);
        expect(persisted.recent_health_count).toBe(8);
      } finally {
        server2.close();
      }

      // Delete test astronaut & verify cascade cleanup
      const delRes = await fetch(`${base}/api/astronauts/${created.id}`, { method: 'DELETE' });
      expect(delRes.status).toBe(200);
      const afterDelAlerts = await (await fetch(`${base}/api/anomalies?astronaut_id=${created.id}`)).json();
      expect(afterDelAlerts.length).toBe(0);

      // Daily Report & Datasets Transparency
      const repRes = await fetch(`${base}/api/reports/daily`);
      expect(repRes.status).toBe(200);
      expect((await repRes.json()).data_sources_present).toContain('SYNTHETIC');

      const dsRes = await fetch(`${base}/api/datasets`);
      expect(dsRes.status).toBe(200);
      const dsJson = await dsRes.json();
      expect(dsJson.datasets.some((d: { dataset_identifier: string }) => d.dataset_identifier === 'OSD-569')).toBe(true);

      // Grounded RAG Assistant: research query, unmonitored telemetry, and out-of-corpus unknown query
      const ragRes = await fetch(`${base}/api/assistant/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: 'How does space radiation affect astronauts?',
          astronaut_id: 1,
        }),
      });
      expect(ragRes.status).toBe(200);
      const ragJson = await ragRes.json();
      expect(ragJson.citations.length).toBeGreaterThanOrEqual(1);
      expect(ragJson.uncertainty_note).toContain('Decision-support only');

      const bpRes = await fetch(`${base}/api/assistant/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: 'What is the astronaut blood pressure and ECG reading today?',
          astronaut_id: 1,
        }),
      });
      expect(bpRes.status).toBe(200);
      const bpJson = await bpRes.json();
      expect(bpJson.answer).toContain('Unavailable Telemetry Notice');

      const unknownRes = await fetch(`${base}/api/assistant/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: 'How many crew landed on Jupiter with Saturn V in 1998?',
        }),
      });
      expect(unknownRes.status).toBe(200);
      const unknownJson = await unknownRes.json();
      expect(unknownJson.citations.length).toBe(0);
      expect(unknownJson.answer).toContain('Insufficient reliable information');
    } finally {
      server.close();
    }
  });
});
