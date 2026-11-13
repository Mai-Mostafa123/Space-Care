import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_DIR = path.join(DATA_DIR, 'processed');
fs.mkdirSync(DB_DIR, { recursive: true });

export const DB_PATH = path.join(DB_DIR, 'aegis_preview.db');
export const db = new DatabaseSync(DB_PATH);

export function utcNowIso(): string {
  return new Date().toISOString();
}

export function initDatabase(): void {
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS astronauts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      call_sign TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL,
      mission_name TEXT NOT NULL,
      age_group TEXT DEFAULT '30-45',
      blood_type TEXT DEFAULT 'Unknown',
      mission_day INTEGER DEFAULT 1,
      mission_duration_days INTEGER DEFAULT 180,
      avatar_url TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      data_source TEXT NOT NULL DEFAULT 'MANUAL',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS profile_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      astronaut_id INTEGER NOT NULL REFERENCES astronauts(id) ON DELETE CASCADE,
      field_changed TEXT NOT NULL,
      previous_value TEXT DEFAULT '',
      new_value TEXT DEFAULT '',
      change_source TEXT NOT NULL DEFAULT 'MANUAL_FORM',
      changed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS health_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      astronaut_id INTEGER NOT NULL REFERENCES astronauts(id) ON DELETE CASCADE,
      recorded_at TEXT NOT NULL,
      heart_rate_bpm REAL,
      spo2_pct REAL,
      sleep_duration_hrs REAL,
      sleep_quality_score REAL,
      deep_sleep_hrs REAL,
      rem_sleep_hrs REAL,
      activity_minutes INTEGER,
      exercise_type TEXT DEFAULT 'Scheduled Exercise',
      stress_score REAL,
      mood_score REAL,
      mood_notes TEXT DEFAULT '',
      data_source TEXT NOT NULL DEFAULT 'MANUAL',
      is_cleaned INTEGER DEFAULT 1,
      missing_imputed INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_health_astro_time ON health_records(astronaut_id, recorded_at);

    CREATE TABLE IF NOT EXISTS environmental_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mission_name TEXT NOT NULL,
      habitat_zone TEXT NOT NULL DEFAULT 'Crew Quarters',
      recorded_at TEXT NOT NULL,
      radiation_msv_day REAL NOT NULL,
      cabin_co2_ppm REAL NOT NULL,
      oxygen_pct REAL NOT NULL,
      temperature_c REAL NOT NULL,
      humidity_pct REAL NOT NULL,
      pressure_kpa REAL NOT NULL,
      data_source TEXT NOT NULL DEFAULT 'MANUAL',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_env_time ON environmental_records(mission_name, recorded_at);

    CREATE TABLE IF NOT EXISTS sleep_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      astronaut_id INTEGER NOT NULL REFERENCES astronauts(id) ON DELETE CASCADE,
      sleep_start TEXT NOT NULL,
      sleep_end TEXT NOT NULL,
      duration_hrs REAL NOT NULL,
      deep_hrs REAL DEFAULT 0,
      rem_hrs REAL DEFAULT 0,
      light_hrs REAL DEFAULT 0,
      wake_events INTEGER DEFAULT 0,
      quality_index REAL DEFAULT 75,
      data_source TEXT NOT NULL DEFAULT 'MANUAL',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      astronaut_id INTEGER NOT NULL REFERENCES astronauts(id) ON DELETE CASCADE,
      recorded_at TEXT NOT NULL,
      activity_type TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      intensity_level TEXT DEFAULT 'Moderate',
      estimated_kcal INTEGER DEFAULT 0,
      resistive_load_kg REAL DEFAULT 0,
      data_source TEXT NOT NULL DEFAULT 'MANUAL',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mood_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      astronaut_id INTEGER NOT NULL REFERENCES astronauts(id) ON DELETE CASCADE,
      logged_at TEXT NOT NULL,
      mood_rating REAL NOT NULL,
      stress_rating REAL NOT NULL,
      workload_rating REAL DEFAULT 5,
      sleep_rested_rating REAL DEFAULT 7,
      journal_note TEXT DEFAULT '',
      entry_method TEXT DEFAULT 'MANUAL_FORM',
      data_source TEXT NOT NULL DEFAULT 'MANUAL',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS anomaly_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      astronaut_id INTEGER NOT NULL REFERENCES astronauts(id) ON DELETE CASCADE,
      detected_at TEXT NOT NULL,
      variables_involved TEXT NOT NULL,
      observed_values_json TEXT NOT NULL,
      baseline_reference_json TEXT NOT NULL,
      deviation_description TEXT NOT NULL,
      detection_method TEXT NOT NULL,
      anomaly_score REAL NOT NULL,
      confidence_level TEXT NOT NULL,
      severity_tier TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      data_source TEXT NOT NULL DEFAULT 'SYNTHETIC',
      explanation TEXT NOT NULL,
      uncertainty_statement TEXT NOT NULL,
      acknowledged_at TEXT
    );

    CREATE TABLE IF NOT EXISTS datasets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dataset_identifier TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      original_source TEXT NOT NULL,
      source_classification TEXT NOT NULL,
      variables_json TEXT NOT NULL,
      file_format TEXT NOT NULL,
      record_count TEXT NOT NULL,
      subject_count INTEGER,
      time_coverage TEXT NOT NULL,
      accessibility TEXT NOT NULL,
      download_or_api_method TEXT NOT NULL,
      license_info TEXT NOT NULL,
      relevance_notes TEXT NOT NULL,
      limitations TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS research_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_id TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      source_org TEXT NOT NULL,
      publication_year INTEGER NOT NULL,
      url TEXT NOT NULL,
      hazard_category TEXT NOT NULL,
      abstract TEXT NOT NULL,
      content_chunks_json TEXT NOT NULL,
      verified_reference TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assistant_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      astronaut_id INTEGER REFERENCES astronauts(id) ON DELETE SET NULL,
      role TEXT NOT NULL,
      message_text TEXT NOT NULL,
      citations_json TEXT DEFAULT '[]',
      context_records_json TEXT DEFAULT '[]',
      inference_engine TEXT DEFAULT 'Local Retrieval',
      uncertainty_note TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT DEFAULT '',
      action TEXT NOT NULL,
      actor TEXT DEFAULT 'LOCAL_OPERATOR',
      details_json TEXT DEFAULT '{}',
      created_at TEXT NOT NULL
    );
  `);
}

export function seedDatabaseIfEmpty(): boolean {
  const now = utcNowIso();
  let newlySeeded = false;

  const dsCount = (db.prepare('SELECT COUNT(*) as c FROM datasets').get() as { c: number }).c;
  const registryPath = path.join(DATA_DIR, 'metadata', 'dataset_registry.json');
  if (dsCount === 0 && fs.existsSync(registryPath)) {
    const items = JSON.parse(fs.readFileSync(registryPath, 'utf-8')) as Array<Record<string, unknown>>;
    const stmt = db.prepare(`
      INSERT INTO datasets (
        dataset_identifier, name, original_source, source_classification,
        variables_json, file_format, record_count, subject_count, time_coverage,
        accessibility, download_or_api_method, license_info, relevance_notes, limitations, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of items) {
      stmt.run(
        String(item.dataset_identifier),
        String(item.name),
        String(item.original_source),
        String(item.source_classification),
        JSON.stringify(item.variables),
        String(item.file_format),
        String(item.record_count),
        item.subject_count === null || item.subject_count === undefined ? null : Number(item.subject_count),
        String(item.time_coverage),
        String(item.accessibility),
        String(item.download_or_api_method),
        String(item.license_info),
        String(item.relevance_notes),
        String(item.limitations),
        now
      );
    }
  }

  const docCount = (db.prepare('SELECT COUNT(*) as c FROM research_documents').get() as { c: number }).c;
  const corpusPath = path.join(DATA_DIR, 'metadata', 'nasa_research_corpus.json');
  if (docCount === 0 && fs.existsSync(corpusPath)) {
    const docs = JSON.parse(fs.readFileSync(corpusPath, 'utf-8')) as Array<Record<string, unknown>>;
    const stmt = db.prepare(`
      INSERT INTO research_documents (
        doc_id, title, source_org, publication_year, url, hazard_category,
        abstract, content_chunks_json, verified_reference
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const doc of docs) {
      stmt.run(
        String(doc.doc_id),
        String(doc.title),
        String(doc.source_org),
        Number(doc.publication_year),
        String(doc.url),
        String(doc.hazard_category),
        String(doc.abstract),
        JSON.stringify(doc.chunks),
        String(doc.verified_reference)
      );
    }
  }

  const astroCount = (db.prepare('SELECT COUNT(*) as c FROM astronauts').get() as { c: number }).c;
  const synthPath = path.join(DATA_DIR, 'synthetic', 'synthetic_benchmark_30d.json');
  if (astroCount === 0 && fs.existsSync(synthPath)) {
    newlySeeded = true;
    const payload = JSON.parse(fs.readFileSync(synthPath, 'utf-8')) as {
      astronauts: Array<Record<string, unknown>>;
      health_records: Array<Record<string, unknown>>;
      environmental_records: Array<Record<string, unknown>>;
    };

    const callSignToId: Record<string, number> = {};
    const insAstro = db.prepare(`
      INSERT INTO astronauts (
        call_sign, full_name, role, mission_name, age_group, blood_type,
        mission_day, mission_duration_days, avatar_url, notes, data_source, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insHist = db.prepare(`
      INSERT INTO profile_history (astronaut_id, field_changed, previous_value, new_value, change_source, changed_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const c of payload.astronauts) {
      const info = insAstro.run(
        String(c.call_sign),
        String(c.full_name),
        String(c.role),
        String(c.mission_name),
        String(c.age_group),
        String(c.blood_type),
        Number(c.mission_day),
        Number(c.mission_duration_days),
        String(c.avatar_url || ''),
        String(c.notes || ''),
        'SYNTHETIC',
        now,
        now
      );
      const id = Number(info.lastInsertRowid);
      callSignToId[String(c.call_sign)] = id;
      insHist.run(id, 'PROFILE_CREATED', '', String(c.call_sign), 'SYSTEM_SEED', now);
    }

    const insEnv = db.prepare(`
      INSERT INTO environmental_records (
        mission_name, habitat_zone, recorded_at, radiation_msv_day, cabin_co2_ppm,
        oxygen_pct, temperature_c, humidity_pct, pressure_kpa, data_source, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const e of payload.environmental_records) {
      insEnv.run(
        String(e.mission_name),
        String(e.habitat_zone),
        String(e.recorded_at),
        Number(e.radiation_msv_day),
        Number(e.cabin_co2_ppm),
        Number(e.oxygen_pct),
        Number(e.temperature_c),
        Number(e.humidity_pct),
        Number(e.pressure_kpa),
        'SYNTHETIC',
        now
      );
    }

    const insHealth = db.prepare(`
      INSERT INTO health_records (
        astronaut_id, recorded_at, heart_rate_bpm, spo2_pct, sleep_duration_hrs,
        sleep_quality_score, deep_sleep_hrs, rem_sleep_hrs, activity_minutes,
        exercise_type, stress_score, mood_score, mood_notes, data_source,
        is_cleaned, missing_imputed, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?)
    `);
    const insSleep = db.prepare(`
      INSERT INTO sleep_records (
        astronaut_id, sleep_start, sleep_end, duration_hrs, deep_hrs, rem_hrs,
        light_hrs, wake_events, quality_index, data_source, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insAct = db.prepare(`
      INSERT INTO activity_records (
        astronaut_id, recorded_at, activity_type, duration_minutes, intensity_level,
        estimated_kcal, resistive_load_kg, data_source, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
    `);
    const insMood = db.prepare(`
      INSERT INTO mood_logs (
        astronaut_id, logged_at, mood_rating, stress_rating, workload_rating,
        sleep_rested_rating, journal_note, entry_method, data_source, created_at
      ) VALUES (?, ?, ?, ?, 5, 7, ?, 'SYNTHETIC_BENCHMARK', ?, ?)
    `);

    for (const h of payload.health_records) {
      const aid = callSignToId[String(h.call_sign)];
      const sleepDur = Number(h.sleep_duration_hrs);
      const deep = Number(h.deep_sleep_hrs);
      const rem = Number(h.rem_sleep_hrs);
      const actMin = Number(h.activity_minutes);

      insHealth.run(
        aid,
        String(h.recorded_at),
        Number(h.heart_rate_bpm),
        Number(h.spo2_pct),
        sleepDur,
        Number(h.sleep_quality_score),
        deep,
        rem,
        actMin,
        String(h.exercise_type),
        Number(h.stress_score),
        Number(h.mood_score),
        String(h.mood_notes),
        'SYNTHETIC',
        now
      );
      insSleep.run(
        aid,
        String(h.recorded_at),
        String(h.recorded_at),
        sleepDur,
        deep,
        rem,
        Math.max(0, Number((sleepDur - deep - rem).toFixed(2))),
        sleepDur < 5.5 ? 2 : 0,
        Number(h.sleep_quality_score),
        'SYNTHETIC',
        now
      );
      insAct.run(
        aid,
        String(h.recorded_at),
        String(h.exercise_type),
        actMin,
        actMin >= 120 ? 'High' : 'Moderate',
        Math.round(actMin * 6.2),
        'SYNTHETIC',
        now
      );
      insMood.run(
        aid,
        String(h.recorded_at),
        Number(h.mood_score),
        Number(h.stress_score),
        String(h.mood_notes),
        'SYNTHETIC',
        now
      );
    }

    db.prepare(`
      INSERT INTO audit_logs (event_type, entity_type, action, details_json, created_at)
      VALUES ('SEED_INIT', 'SYSTEM', 'INITIALIZE_SYNTHETIC_AND_NASA_REGISTRY', ?, ?)
    `).run(JSON.stringify({ astronauts: payload.astronauts.length, health: payload.health_records.length }), now);
  }

  return newlySeeded;
}
