export type DataSource = 'REAL' | 'SYNTHETIC' | 'MANUAL';

export type PageId =
  | 'overview'
  | 'profiles'
  | 'health'
  | 'environment'
  | 'anomalies'
  | 'assistant'
  | 'voice'
  | 'reports'
  | 'transparency'
  | 'hazards';

export interface Astronaut {
  id: number;
  call_sign: string;
  full_name: string;
  role: string;
  mission_name: string;
  age_group: string;
  blood_type: string;
  mission_day: number;
  mission_duration_days: number;
  avatar_url: string;
  notes: string;
  data_source: DataSource;
  created_at: string;
  updated_at: string;
}

export interface ProfileHistoryEntry {
  id: number;
  astronaut_id: number;
  field_changed: string;
  previous_value: string;
  new_value: string;
  change_source: string;
  changed_at: string;
}

export interface HealthRecord {
  id: number;
  astronaut_id: number;
  recorded_at: string;
  heart_rate_bpm: number | null;
  spo2_pct: number | null;
  sleep_duration_hrs: number | null;
  sleep_quality_score: number | null;
  deep_sleep_hrs: number | null;
  rem_sleep_hrs: number | null;
  activity_minutes: number | null;
  exercise_type: string;
  stress_score: number | null;
  mood_score: number | null;
  mood_notes: string;
  data_source: DataSource;
  is_cleaned: boolean | number;
  missing_imputed: boolean | number;
}

export interface EnvironmentalRecord {
  id: number;
  mission_name: string;
  habitat_zone: string;
  recorded_at: string;
  radiation_msv_day: number;
  cabin_co2_ppm: number;
  oxygen_pct: number;
  temperature_c: number;
  humidity_pct: number;
  pressure_kpa: number;
  data_source: DataSource;
}

export interface AnomalyAlert {
  id: number;
  astronaut_id: number;
  call_sign?: string;
  detected_at: string;
  variables_involved: string;
  observed_values: Record<string, number>;
  baseline_reference: Record<string, { mean: number; std: number; median: number; n_samples: number }>;
  deviation_description: string;
  detection_method: string;
  anomaly_score: number;
  confidence_level: string;
  severity_tier: 'ADVISORY' | 'ELEVATED' | 'CRITICAL_REVIEW';
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  data_source: DataSource;
  explanation: string;
  uncertainty_statement: string;
  acknowledged_at: string | null;
}

export interface MLEvaluationMetrics {
  evaluation_scope: string;
  total_samples: number;
  positive_ground_truth: number;
  precision: number;
  recall: number;
  f1_score: number;
  false_positive_rate: number;
  confusion_matrix: { tp: number; fp: number; fn: number; tn: number };
}

export interface ResearchCitation {
  doc_id: string;
  title: string;
  source_org: string;
  url: string;
  hazard_category: string;
  verified_reference: string;
  excerpt: string;
  score?: number;
}

export interface AssistantMessage {
  id?: number;
  role: 'user' | 'assistant';
  message_text: string;
  citations: ResearchCitation[];
  context_records: Array<Record<string, unknown>>;
  inference_engine: string;
  uncertainty_note?: string;
  created_at?: string;
}

export interface VoiceExtractionResult {
  transcript: string;
  target_mode: 'health_log' | 'profile_update';
  extracted_fields: Record<string, unknown>;
  uncertain_fields: string[];
  transcription_errors: string[];
  requires_confirmation: boolean;
  validation_passed: boolean;
}

export interface DatasetEntry {
  dataset_identifier: string;
  name: string;
  original_source: string;
  source_classification: 'REAL' | 'SIMULATED' | 'MANUAL';
  variables: string[];
  file_format: string;
  record_count: string;
  subject_count: number | null;
  time_coverage: string;
  accessibility: string;
  download_or_api_method: string;
  license_info: string;
  relevance_notes: string;
  limitations: string;
}

export interface SystemStatus {
  runtime_mode: string;
  api_version: string;
  database_connected: boolean;
  database_path: string;
  offline_ready: boolean;
  ollama: {
    connected: boolean;
    base_url: string;
    available_models: string[];
    preferred_model: string;
    embed_model: string;
    how_to_start?: string;
  };
  counts: {
    astronauts: number;
    health_records: number;
    environmental_records: number;
    active_anomalies: number;
    datasets: number;
    research_documents: number;
  };
}

export interface DailyReport {
  generated_at: string;
  report_type: string;
  data_sources_present: string[];
  non_diagnostic_disclaimer: string;
  crew_summaries: Array<{
    astronaut_id: number;
    call_sign: string;
    full_name: string;
    data_source: DataSource;
    latest_recorded_at: string | null;
    latest_hr_bpm: number | null;
    latest_spo2_pct: number | null;
    latest_sleep_hrs: number | null;
    seven_day_avg_hr: number | null;
    seven_day_avg_spo2: number | null;
    seven_day_avg_sleep: number | null;
  }>;
  environmental_summary: EnvironmentalRecord | null;
  active_anomalies_count: number;
  active_anomalies: Array<{
    id: number;
    call_sign?: string;
    severity_tier: string;
    variables_involved: string;
    explanation: string;
    data_source: DataSource;
  }>;
}
