import express from 'express';
import path from 'node:path';
import { db, DB_PATH, initDatabase, seedDatabaseIfEmpty, utcNowIso } from './server/db.ts';
import { evaluateSyntheticBenchmark, runAnomalyDetectionForAstronaut } from './server/ml.ts';
import { checkLocalOllamaStatus, queryGroundedAssistant } from './server/rag.ts';
import { extractStructuredFromTranscript } from './server/voice.ts';

export function createApp() {
  initDatabase();
  const seeded = seedDatabaseIfEmpty();
  if (seeded) {
    const crew = db.prepare('SELECT id FROM astronauts').all() as Array<{ id: number }>;
    for (const c of crew) {
      runAnomalyDetectionForAstronaut(c.id, true);
    }
  }

  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'microphone=*');
    next();
  });
  app.use(express.json({ limit: '2mb' }));

  const VALID_SOURCES = new Set(['REAL', 'SYNTHETIC', 'MANUAL']);
  const parsePositiveId = (raw: string): number | null => {
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : null;
  };
  const safeIsoTimestamp = (raw: unknown): string | null => {
    if (!raw) return utcNowIso();
    const d = new Date(String(raw));
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  };

  // 1. /api/astronauts
  app.get('/api/astronauts', (_req, res) => {
    const rows = db.prepare('SELECT * FROM astronauts ORDER BY id ASC').all();
    res.json(rows);
  });

  app.get('/api/astronauts/:id', (req, res) => {
    const id = parsePositiveId(req.params.id);
    if (!id) return res.status(400).json({ detail: 'Invalid astronaut ID' });
    const astro = db.prepare('SELECT * FROM astronauts WHERE id = ?').get(id);
    if (!astro) return res.status(404).json({ detail: 'Astronaut profile not found' });
    const history = db
      .prepare('SELECT * FROM profile_history WHERE astronaut_id = ? ORDER BY changed_at DESC')
      .all(id);
    const healthCount = (
      db.prepare('SELECT COUNT(*) as c FROM health_records WHERE astronaut_id = ?').get(id) as { c: number }
    ).c;
    res.json({ profile: astro, history, recent_health_count: healthCount });
  });

  app.post('/api/astronauts', (req, res) => {
    const {
      call_sign,
      full_name,
      role,
      mission_name,
      age_group = '30-45',
      blood_type = 'Unknown',
      mission_day = 1,
      mission_duration_days = 180,
      avatar_url = '',
      notes = '',
      data_source = 'MANUAL',
      change_source = 'MANUAL_FORM',
    } = req.body || {};

    if (!call_sign || !full_name || !role || !mission_name) {
      return res.status(422).json({ detail: 'call_sign, full_name, role, and mission_name are required.' });
    }
    if (!VALID_SOURCES.has(String(data_source))) {
      return res.status(422).json({ detail: 'data_source must be REAL, SYNTHETIC, or MANUAL.' });
    }
    const mDay = Number(mission_day);
    const mDur = Number(mission_duration_days);
    if (!Number.isFinite(mDay) || mDay < 0 || mDay > 2000 || !Number.isFinite(mDur) || mDur < 1 || mDur > 2000) {
      return res.status(422).json({ detail: 'mission_day (0-2000) and mission_duration_days (1-2000) must be valid integers.' });
    }
    const exists = db.prepare('SELECT id FROM astronauts WHERE call_sign = ?').get(String(call_sign).trim());
    if (exists) {
      return res.status(409).json({ detail: `Call sign ${call_sign} already exists.` });
    }
    const now = utcNowIso();
    const info = db
      .prepare(`
        INSERT INTO astronauts (
          call_sign, full_name, role, mission_name, age_group, blood_type,
          mission_day, mission_duration_days, avatar_url, notes, data_source, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        String(call_sign).trim(),
        String(full_name).trim(),
        String(role).trim(),
        String(mission_name).trim(),
        String(age_group),
        String(blood_type),
        Math.round(mDay),
        Math.round(mDur),
        String(avatar_url),
        String(notes),
        String(data_source),
        now,
        now
      );
    const id = Number(info.lastInsertRowid);
    db.prepare(
      'INSERT INTO profile_history (astronaut_id, field_changed, previous_value, new_value, change_source, changed_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, 'PROFILE_CREATED', '', String(call_sign).trim(), String(change_source), now);
    db.prepare(
      'INSERT INTO audit_logs (event_type, entity_type, entity_id, action, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('PROFILE_CREATE', 'ASTRONAUT', String(id), 'CREATE', JSON.stringify({ call_sign, data_source }), now);

    const created = db.prepare('SELECT * FROM astronauts WHERE id = ?').get(id);
    res.status(201).json(created);
  });

  app.put('/api/astronauts/:id', (req, res) => {
    const id = parsePositiveId(req.params.id);
    if (!id) return res.status(400).json({ detail: 'Invalid astronaut ID' });
    const astro = db.prepare('SELECT * FROM astronauts WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!astro) return res.status(404).json({ detail: 'Astronaut profile not found' });

    const editable = ['full_name', 'role', 'mission_name', 'age_group', 'blood_type', 'mission_day', 'mission_duration_days', 'notes'];
    const changeSource = String(req.body?.change_source || 'MANUAL_FORM');
    const now = utcNowIso();
    const changedFields: string[] = [];

    for (const field of editable) {
      if (req.body && req.body[field] !== undefined && String(req.body[field]) !== String(astro[field])) {
        if ((field === 'mission_day' && (Number(req.body[field]) < 0 || Number(req.body[field]) > 2000)) ||
            (field === 'mission_duration_days' && (Number(req.body[field]) < 1 || Number(req.body[field]) > 2000))) {
          return res.status(422).json({ detail: `Invalid bounds for ${field}` });
        }
        db.prepare(`UPDATE astronauts SET ${field} = ? WHERE id = ?`).run(req.body[field], id);
        db.prepare(
          'INSERT INTO profile_history (astronaut_id, field_changed, previous_value, new_value, change_source, changed_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(id, field, String(astro[field] ?? ''), String(req.body[field]), changeSource, now);
        changedFields.push(field);
      }
    }
    db.prepare('UPDATE astronauts SET updated_at = ? WHERE id = ?').run(now, id);
    db.prepare(
      'INSERT INTO audit_logs (event_type, entity_type, entity_id, action, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('PROFILE_UPDATE', 'ASTRONAUT', String(id), 'UPDATE', JSON.stringify(changedFields), now);

    res.json(db.prepare('SELECT * FROM astronauts WHERE id = ?').get(id));
  });

  app.delete('/api/astronauts/:id', (req, res) => {
    const id = parsePositiveId(req.params.id);
    if (!id) return res.status(400).json({ detail: 'Invalid astronaut ID' });
    const astro = db.prepare('SELECT * FROM astronauts WHERE id = ?').get(id) as { call_sign: string } | undefined;
    if (!astro) return res.status(404).json({ detail: 'Astronaut profile not found' });
    db.prepare('DELETE FROM astronauts WHERE id = ?').run(id);
    db.prepare(
      'INSERT INTO audit_logs (event_type, entity_type, entity_id, action, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('PROFILE_DELETE', 'ASTRONAUT', String(id), 'DELETE', JSON.stringify({ call_sign: astro.call_sign }), utcNowIso());
    res.json({ deleted: true, astronaut_id: id, call_sign: astro.call_sign });
  });

  // 2. /api/health
  app.get('/api/health', (req, res) => {
    const astronautId = req.query.astronaut_id ? parsePositiveId(String(req.query.astronaut_id)) : null;
    if (req.query.astronaut_id && !astronautId) return res.status(400).json({ detail: 'Invalid astronaut_id query parameter' });
    const dataSource = req.query.data_source ? String(req.query.data_source) : null;
    const clauses: string[] = [];
    const params: Array<string | number> = [];
    if (astronautId) {
      clauses.push('astronaut_id = ?');
      params.push(astronautId);
    }
    if (dataSource && dataSource !== 'ALL') {
      clauses.push('data_source = ?');
      params.push(dataSource);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = db.prepare(`SELECT * FROM health_records ${where} ORDER BY recorded_at ASC`).all(...params);
    res.json(rows);
  });

  app.post('/api/health', (req, res) => {
    const body = req.body || {};
    const astronautId = parsePositiveId(String(body.astronaut_id || ''));
    if (!astronautId || !db.prepare('SELECT id FROM astronauts WHERE id = ?').get(astronautId)) {
      return res.status(404).json({ detail: 'Target astronaut not found' });
    }
    const hr = body.heart_rate_bpm !== undefined && body.heart_rate_bpm !== null ? Number(body.heart_rate_bpm) : null;
    const spo2 = body.spo2_pct !== undefined && body.spo2_pct !== null ? Number(body.spo2_pct) : null;
    const sleep = body.sleep_duration_hrs !== undefined && body.sleep_duration_hrs !== null ? Number(body.sleep_duration_hrs) : null;
    const stressIn = body.stress_score !== undefined && body.stress_score !== null ? Number(body.stress_score) : null;
    const moodIn = body.mood_score !== undefined && body.mood_score !== null ? Number(body.mood_score) : null;
    if (hr !== null && (!Number.isFinite(hr) || hr < 30 || hr > 220)) return res.status(422).json({ detail: 'heart_rate_bpm must be between 30 and 220' });
    if (spo2 !== null && (!Number.isFinite(spo2) || spo2 < 70 || spo2 > 100)) return res.status(422).json({ detail: 'spo2_pct must be between 70 and 100' });
    if (sleep !== null && (!Number.isFinite(sleep) || sleep < 0 || sleep > 24)) return res.status(422).json({ detail: 'sleep_duration_hrs must be between 0 and 24' });
    if (stressIn !== null && (!Number.isFinite(stressIn) || stressIn < 1 || stressIn > 10)) return res.status(422).json({ detail: 'stress_score must be between 1 and 10' });
    if (moodIn !== null && (!Number.isFinite(moodIn) || moodIn < 1 || moodIn > 10)) return res.status(422).json({ detail: 'mood_score must be between 1 and 10' });

    const dataSource = String(body.data_source || 'MANUAL');
    if (!VALID_SOURCES.has(dataSource)) return res.status(422).json({ detail: 'data_source must be REAL, SYNTHETIC, or MANUAL' });
    const recordedAt = safeIsoTimestamp(body.recorded_at);
    if (!recordedAt) return res.status(422).json({ detail: 'Invalid ISO-8601 recorded_at timestamp' });

    const now = utcNowIso();
    const hist = db
      .prepare('SELECT heart_rate_bpm, spo2_pct, sleep_duration_hrs, stress_score, mood_score FROM health_records WHERE astronaut_id = ? ORDER BY recorded_at DESC LIMIT 14')
      .all(astronautId) as Array<Record<string, number | null>>;

    const medianOf = (key: string, fallback: number) => {
      const vals = hist.map((r) => r[key]).filter((v): v is number => typeof v === 'number').sort((a, b) => a - b);
      return vals.length ? vals[Math.floor(vals.length / 2)] : fallback;
    };

    let imputed = false;
    const finalHr = hr ?? (hist.length ? ((imputed = true), medianOf('heart_rate_bpm', 65)) : null);
    const finalSpo2 = spo2 ?? (hist.length ? ((imputed = true), medianOf('spo2_pct', 98)) : null);
    const finalSleep = sleep ?? (hist.length ? ((imputed = true), medianOf('sleep_duration_hrs', 7.0)) : null);
    const finalStress = stressIn ?? (hist.length ? ((imputed = true), medianOf('stress_score', 3.0)) : null);
    const finalMood = moodIn ?? (hist.length ? ((imputed = true), medianOf('mood_score', 7.5)) : null);
    const actMin = body.activity_minutes != null ? Math.max(0, Math.min(1440, Number(body.activity_minutes))) : 60;
    const exType = String(body.exercise_type || 'Scheduled Exercise');
    const notes = String(body.mood_notes || '');
    const sleepQual = finalSleep ? Math.min(98, Math.max(40, Math.round(58 + finalSleep * 4))) : 75;
    const deepHrs = finalSleep ? Number((finalSleep * 0.21).toFixed(2)) : 1.4;
    const remHrs = finalSleep ? Number((finalSleep * 0.23).toFixed(2)) : 1.6;

    const info = db
      .prepare(`
        INSERT INTO health_records (
          astronaut_id, recorded_at, heart_rate_bpm, spo2_pct, sleep_duration_hrs,
          sleep_quality_score, deep_sleep_hrs, rem_sleep_hrs, activity_minutes,
          exercise_type, stress_score, mood_score, mood_notes, data_source,
          is_cleaned, missing_imputed, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `)
      .run(
        astronautId, recordedAt, finalHr, finalSpo2, finalSleep, sleepQual, deepHrs, remHrs,
        actMin, exType, finalStress, finalMood, notes, dataSource, imputed ? 1 : 0, now
      );

    if (finalSleep !== null) {
      db.prepare(`
        INSERT INTO sleep_records (astronaut_id, sleep_start, sleep_end, duration_hrs, deep_hrs, rem_hrs, light_hrs, wake_events, quality_index, data_source, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(astronautId, recordedAt, recordedAt, finalSleep, deepHrs, remHrs, Math.max(0, Number((finalSleep - deepHrs - remHrs).toFixed(2))), finalSleep < 5.5 ? 2 : 0, sleepQual, dataSource, now);
    }
    db.prepare(`
      INSERT INTO activity_records (astronaut_id, recorded_at, activity_type, duration_minutes, intensity_level, estimated_kcal, resistive_load_kg, data_source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(astronautId, recordedAt, exType, actMin, actMin >= 120 ? 'High' : 'Moderate', Math.round(actMin * 6.2), dataSource, now);
    if (finalMood !== null && finalStress !== null) {
      db.prepare(`
        INSERT INTO mood_logs (astronaut_id, logged_at, mood_rating, stress_rating, workload_rating, sleep_rested_rating, journal_note, entry_method, data_source, created_at)
        VALUES (?, ?, ?, ?, 5, 7, ?, 'MANUAL_FORM', ?, ?)
      `).run(astronautId, recordedAt, finalMood, finalStress, notes, dataSource, now);
    }
    db.prepare(
      'INSERT INTO audit_logs (event_type, entity_type, entity_id, action, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('HEALTH_INGEST', 'HEALTH_RECORD', String(info.lastInsertRowid), 'CREATE', JSON.stringify({ astronaut_id: astronautId, data_source: dataSource, imputed }), now);

    // Re-evaluate personal-baseline anomaly detector reactively when new data arrives
    const detection = runAnomalyDetectionForAstronaut(astronautId, true);

    res.status(201).json({
      id: Number(info.lastInsertRowid),
      astronaut_id: astronautId,
      recorded_at: recordedAt,
      missing_imputed: imputed,
      data_source: dataSource,
      alerts_detected: detection.alerts_detected,
    });
  });

  // 3. /api/environment
  app.get('/api/environment', (req, res) => {
    const dataSource = req.query.data_source ? String(req.query.data_source) : null;
    const rows =
      dataSource && dataSource !== 'ALL'
        ? db.prepare('SELECT * FROM environmental_records WHERE data_source = ? ORDER BY recorded_at ASC').all(dataSource)
        : db.prepare('SELECT * FROM environmental_records ORDER BY recorded_at ASC').all();
    res.json(rows);
  });

  app.post('/api/environment', (req, res) => {
    const b = req.body || {};
    const rad = Number(b.radiation_msv_day);
    const co2 = Number(b.cabin_co2_ppm);
    const o2 = Number(b.oxygen_pct);
    const temp = Number(b.temperature_c);
    const hum = Number(b.humidity_pct);
    const press = Number(b.pressure_kpa);
    if (
      !Number.isFinite(rad) || rad < 0 || rad > 500 ||
      !Number.isFinite(co2) || co2 < 100 || co2 > 50000 ||
      !Number.isFinite(o2) || o2 < 10 || o2 > 40 ||
      !Number.isFinite(temp) || temp < 0 || temp > 50 ||
      !Number.isFinite(hum) || hum < 5 || hum > 99 ||
      !Number.isFinite(press) || press < 30 || press > 130
    ) {
      return res.status(422).json({ detail: 'Environmental sensor values out of valid physical bounds.' });
    }
    const dataSource = String(b.data_source || 'MANUAL');
    if (!VALID_SOURCES.has(dataSource)) return res.status(422).json({ detail: 'Invalid data_source' });
    const recordedAt = safeIsoTimestamp(b.recorded_at);
    if (!recordedAt) return res.status(422).json({ detail: 'Invalid ISO-8601 recorded_at timestamp' });

    const now = utcNowIso();
    const info = db
      .prepare(`
        INSERT INTO environmental_records (
          mission_name, habitat_zone, recorded_at, radiation_msv_day, cabin_co2_ppm,
          oxygen_pct, temperature_c, humidity_pct, pressure_kpa, data_source, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        String(b.mission_name || 'ARTEMIS-SIM-04'),
        String(b.habitat_zone || 'Crew Quarters & Medical Bay'),
        recordedAt, rad, co2, o2, temp, hum, press, dataSource, now
      );
    res.status(201).json({ id: Number(info.lastInsertRowid), recorded_at: recordedAt, data_source: dataSource });
  });

  // 4. /api/anomalies
  app.get('/api/anomalies', (req, res) => {
    const astronautId = req.query.astronaut_id ? Number(req.query.astronaut_id) : null;
    const statusFilter = req.query.status ? String(req.query.status) : null;
    const clauses: string[] = [];
    const params: Array<string | number> = [];
    if (astronautId) {
      clauses.push('a.astronaut_id = ?');
      params.push(astronautId);
    }
    if (statusFilter && statusFilter !== 'ALL') {
      clauses.push('a.status = ?');
      params.push(statusFilter);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = db
      .prepare(`
        SELECT a.*, ast.call_sign
        FROM anomaly_alerts a
        JOIN astronauts ast ON ast.id = a.astronaut_id
        ${where}
        ORDER BY a.detected_at DESC
      `)
      .all(...params) as Array<Record<string, unknown>>;

    res.json(
      rows.map((r) => ({
        ...r,
        observed_values: JSON.parse(String(r.observed_values_json || '{}')),
        baseline_reference: JSON.parse(String(r.baseline_reference_json || '{}')),
      }))
    );
  });

  app.post('/api/anomalies/detect/:id', (req, res) => {
    const id = parsePositiveId(req.params.id);
    if (!id) return res.status(400).json({ detail: 'Invalid astronaut ID' });
    const result = runAnomalyDetectionForAstronaut(id, true);
    if ('error' in result) return res.status(404).json({ detail: result.error });
    res.json(result);
  });

  app.post('/api/anomalies/detect-all', (_req, res) => {
    const crew = db.prepare('SELECT id FROM astronauts').all() as Array<{ id: number }>;
    const results = crew.map((c) => runAnomalyDetectionForAstronaut(c.id, true));
    res.json({ crew_scanned: results.length, results });
  });

  app.get('/api/anomalies/evaluation', (_req, res) => {
    res.json(evaluateSyntheticBenchmark());
  });

  app.patch('/api/anomalies/:id', (req, res) => {
    const id = parsePositiveId(req.params.id);
    if (!id) return res.status(400).json({ detail: 'Invalid anomaly alert ID' });
    const status = String(req.body?.status || '');
    if (!['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'].includes(status)) {
      return res.status(422).json({ detail: 'Invalid status' });
    }
    const existing = db.prepare('SELECT id FROM anomaly_alerts WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ detail: 'Anomaly alert not found' });
    const ackAt = status === 'ACTIVE' ? null : utcNowIso();
    db.prepare('UPDATE anomaly_alerts SET status = ?, acknowledged_at = ? WHERE id = ?').run(status, ackAt, id);
    res.json({ id, status, acknowledged_at: ackAt });
  });

  // 5. /api/assistant
  app.get('/api/assistant/status', async (_req, res) => {
    res.json(await checkLocalOllamaStatus());
  });

  app.get('/api/assistant/history', (req, res) => {
    const sessionId = String(req.query.session_id || 'default-local-session');
    const rows = db
      .prepare('SELECT * FROM assistant_conversations WHERE session_id = ? ORDER BY id ASC')
      .all(sessionId) as Array<Record<string, unknown>>;
    res.json(
      rows.map((r) => ({
        ...r,
        citations: JSON.parse(String(r.citations_json || '[]')),
        context_records: JSON.parse(String(r.context_records_json || '[]')),
      }))
    );
  });

  app.post('/api/assistant/query', async (req, res, next) => {
    try {
      const question = String(req.body?.question || '').trim();
      if (question.length < 2) return res.status(422).json({ detail: 'Question must be at least 2 characters.' });
      const rawAstroId = req.body?.astronaut_id;
      const astronautId = rawAstroId !== null && rawAstroId !== undefined && rawAstroId !== '' ? parsePositiveId(String(rawAstroId)) : null;
      if (rawAstroId !== null && rawAstroId !== undefined && rawAstroId !== '' && !astronautId) {
        return res.status(400).json({ detail: 'Invalid astronaut_id' });
      }
      const sessionId = String(req.body?.session_id || 'default-local-session');
      const modelName = req.body?.model_name ? String(req.body.model_name) : undefined;
      const out = await queryGroundedAssistant(question, astronautId, sessionId, modelName);
      res.json(out);
    } catch (err) {
      next(err);
    }
  });

  // 6. /api/voice
  app.post('/api/voice/extract', (req, res) => {
    const transcript = String(req.body?.transcript || '');
    const targetMode = req.body?.target_mode === 'profile_update' ? 'profile_update' : 'health_log';
    if (transcript.trim().length < 3) {
      return res.status(422).json({ detail: 'Transcript must be at least 3 characters.' });
    }
    res.json(extractStructuredFromTranscript(transcript, targetMode));
  });

  app.post('/api/voice/transcribe', (_req, res) => {
    res.status(501).json({
      success: false,
      engine: 'unavailable_in_node_preview',
      error:
        'Offline Whisper/Vosk binary transcription runs in the Python FastAPI backend (/backend/voice/voice_processor.py). In browser preview, use the browser microphone Web Speech recognition or paste/edit the transcript for structured extraction.',
    });
  });

  // 7. /api/reports
  app.get('/api/reports/daily', (req, res) => {
    const astronautId = req.query.astronaut_id ? Number(req.query.astronaut_id) : null;
    const astronauts = astronautId
      ? (db.prepare('SELECT * FROM astronauts WHERE id = ?').all(astronautId) as Array<Record<string, unknown>>)
      : (db.prepare('SELECT * FROM astronauts ORDER BY id ASC').all() as Array<Record<string, unknown>>);
    const latestEnv = db.prepare('SELECT * FROM environmental_records ORDER BY recorded_at DESC LIMIT 1').get() as
      | Record<string, unknown>
      | undefined;
    const activeAlerts = db
      .prepare("SELECT a.*, ast.call_sign FROM anomaly_alerts a JOIN astronauts ast ON ast.id = a.astronaut_id WHERE a.status = 'ACTIVE'")
      .all() as Array<Record<string, unknown>>;

    const sourceSet = new Set<string>();
    const crewSummaries = astronauts.map((astro) => {
      sourceSet.add(String(astro.data_source));
      const recs = db
        .prepare('SELECT * FROM health_records WHERE astronaut_id = ? ORDER BY recorded_at DESC LIMIT 7')
        .all(Number(astro.id)) as Array<Record<string, unknown>>;
      for (const r of recs) sourceSet.add(String(r.data_source));
      const avg = (k: string) =>
        recs.length ? Number((recs.reduce((s, r) => s + Number(r[k] || 0), 0) / recs.length).toFixed(2)) : null;
      const latest = recs[0];
      return {
        astronaut_id: astro.id,
        call_sign: astro.call_sign,
        full_name: astro.full_name,
        data_source: astro.data_source,
        latest_recorded_at: latest?.recorded_at || null,
        latest_hr_bpm: latest?.heart_rate_bpm ?? null,
        latest_spo2_pct: latest?.spo2_pct ?? null,
        latest_sleep_hrs: latest?.sleep_duration_hrs ?? null,
        seven_day_avg_hr: avg('heart_rate_bpm'),
        seven_day_avg_spo2: avg('spo2_pct'),
        seven_day_avg_sleep: avg('sleep_duration_hrs'),
      };
    });

    res.json({
      generated_at: utcNowIso(),
      report_type: 'DAILY_CREW_AND_HABITAT_SUMMARY',
      data_sources_present: Array.from(sourceSet).sort(),
      non_diagnostic_disclaimer:
        'Operational decision-support summary only. Synthetic records are explicitly labeled SYNTHETIC and do not represent clinical diagnoses or real astronaut flight records.',
      crew_summaries: crewSummaries,
      environmental_summary: latestEnv || null,
      active_anomalies_count: activeAlerts.length,
      active_anomalies: activeAlerts,
    });
  });

  // 8. /api/datasets
  app.get('/api/datasets', (_req, res) => {
    const ds = db.prepare('SELECT * FROM datasets ORDER BY id ASC').all() as Array<Record<string, unknown>>;
    const docs = db.prepare('SELECT * FROM research_documents ORDER BY id ASC').all() as Array<Record<string, unknown>>;
    res.json({
      datasets: ds.map((d) => ({ ...d, variables: JSON.parse(String(d.variables_json || '[]')) })),
      research_documents: docs.map((r) => ({ ...r, chunks: JSON.parse(String(r.content_chunks_json || '[]')) })),
    });
  });

  // 9. /api/system
  app.get('/api/system/status', async (_req, res) => {
    const ollama = await checkLocalOllamaStatus();
    const countOf = (table: string) =>
      (db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number }).c;
    const activeAnom = (
      db.prepare("SELECT COUNT(*) as c FROM anomaly_alerts WHERE status = 'ACTIVE'").get() as { c: number }
    ).c;

    res.json({
      runtime_mode: 'NODE_PREVIEW_RUNTIME',
      fastapi_reference_available: true,
      api_version: '1.0.0',
      database_connected: true,
      database_path: DB_PATH,
      offline_ready: true,
      ollama,
      counts: {
        astronauts: countOf('astronauts'),
        health_records: countOf('health_records'),
        environmental_records: countOf('environmental_records'),
        active_anomalies: activeAnom,
        datasets: countOf('datasets'),
        research_documents: countOf('research_documents'),
      },
    });
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) return next(err);
    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({ detail: 'Malformed JSON request payload.' });
    }
    return res.status(500).json({ detail: 'Internal server error' });
  });

  return app;
}

async function startServer() {
  const app = createApp();
  const port = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use('/src/assets', express.static(path.resolve(process.cwd(), 'src', 'assets')));
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Aegis Orbital Health server running on http://0.0.0.0:${port}`);
  });
}

// Only bind port when executed directly, allowing Vitest/Supertest-style unit imports cleanly
if (process.argv[1] && process.argv[1].endsWith('server.ts')) {
  startServer();
}
