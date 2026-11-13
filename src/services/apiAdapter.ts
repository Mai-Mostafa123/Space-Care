import type {
  AnomalyAlert,
  AssistantMessage,
  Astronaut,
  DailyReport,
  DatasetEntry,
  EnvironmentalRecord,
  HealthRecord,
  MLEvaluationMetrics,
  ProfileHistoryEntry,
  SystemStatus,
  VoiceExtractionResult,
} from '../types/domain';

/**
 * Unified Backend Adapter
 * Defaults to same-origin `/api` (AI Studio preview Express+SQLite or Vite proxy),
 * and seamlessly targets local Python FastAPI when `VITE_API_BASE_URL` (e.g. `http://localhost:8000`) is configured.
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || '';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errBody.detail || `API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getBaseUrl: () => API_BASE || window.location.origin,

  // System
  getSystemStatus: () => apiFetch<SystemStatus>('/api/system/status'),

  // Astronauts
  listAstronauts: () => apiFetch<Astronaut[]>('/api/astronauts'),
  getAstronautDetail: (id: number) =>
    apiFetch<{ profile: Astronaut; history: ProfileHistoryEntry[]; recent_health_count: number }>(`/api/astronauts/${id}`),
  createAstronaut: (payload: Partial<Astronaut> & { change_source?: string }) =>
    apiFetch<Astronaut>('/api/astronauts', { method: 'POST', body: JSON.stringify(payload) }),
  updateAstronaut: (id: number, payload: Partial<Astronaut> & { change_source?: string }) =>
    apiFetch<Astronaut>(`/api/astronauts/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteAstronaut: (id: number) =>
    apiFetch<{ deleted: boolean }>(`/api/astronauts/${id}`, { method: 'DELETE' }),

  // Health & Environment
  listHealth: (astronautId?: number, dataSource?: string) => {
    const params = new URLSearchParams();
    if (astronautId) params.set('astronaut_id', String(astronautId));
    if (dataSource && dataSource !== 'ALL') params.set('data_source', dataSource);
    const qs = params.toString();
    return apiFetch<HealthRecord[]>(`/api/health${qs ? `?${qs}` : ''}`);
  },
  createHealth: (payload: Partial<HealthRecord>) =>
    apiFetch<{ id: number; missing_imputed: boolean; data_source: string }>('/api/health', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  listEnvironment: (dataSource?: string) => {
    const qs = dataSource && dataSource !== 'ALL' ? `?data_source=${encodeURIComponent(dataSource)}` : '';
    return apiFetch<EnvironmentalRecord[]>(`/api/environment${qs}`);
  },
  createEnvironment: (payload: Partial<EnvironmentalRecord>) =>
    apiFetch<{ id: number }>('/api/environment', { method: 'POST', body: JSON.stringify(payload) }),

  // Anomalies & ML
  listAnomalies: (astronautId?: number, status?: string) => {
    const params = new URLSearchParams();
    if (astronautId) params.set('astronaut_id', String(astronautId));
    if (status && status !== 'ALL') params.set('status', status);
    const qs = params.toString();
    return apiFetch<AnomalyAlert[]>(`/api/anomalies${qs ? `?${qs}` : ''}`);
  },
  runAnomalyDetectionAll: () => apiFetch<{ crew_scanned: number }>('/api/anomalies/detect-all', { method: 'POST' }),
  updateAnomalyStatus: (id: number, status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED') =>
    apiFetch<{ id: number; status: string }>(`/api/anomalies/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  getMLEvaluation: () => apiFetch<MLEvaluationMetrics>('/api/anomalies/evaluation'),

  // Assistant
  getAssistantHistory: (sessionId = 'default-local-session') =>
    apiFetch<AssistantMessage[]>(`/api/assistant/history?session_id=${encodeURIComponent(sessionId)}`),
  queryAssistant: (question: string, astronautId: number | null, sessionId = 'default-local-session') =>
    apiFetch<{
      answer: string;
      citations: AssistantMessage['citations'];
      context_records: Array<Record<string, unknown>>;
      inference_engine: string;
      ollama_connected: boolean;
      uncertainty_note: string;
    }>('/api/assistant/query', {
      method: 'POST',
      body: JSON.stringify({ question, astronaut_id: astronautId, session_id: sessionId }),
    }),

  // Voice
  transcribeAudio: async (
    audioBlob: Blob,
    targetMode: 'health_log' | 'profile_update',
    astronautId?: number
  ): Promise<{
    success: boolean;
    transcript?: string;
    engine: string;
    error?: string | null;
    extracted?: VoiceExtractionResult | null;
  }> => {
    const form = new FormData();
    const ext = audioBlob.type.includes('ogg') ? 'ogg' : audioBlob.type.includes('mp4') ? 'm4a' : 'webm';
    form.append('audio', audioBlob, `crew-voice-log.${ext}`);
    form.append('target_mode', targetMode);
    if (astronautId) form.append('astronaut_id', String(astronautId));
    const res = await fetch(`${API_BASE}/api/voice/transcribe`, {
      method: 'POST',
      body: form,
    });
    const body = await res.json().catch(() => ({
      success: false,
      engine: 'unavailable',
      error: res.statusText || `HTTP ${res.status}`,
    }));
    return body;
  },
  extractVoiceTranscript: (transcript: string, targetMode: 'health_log' | 'profile_update', astronautId?: number) =>
    apiFetch<VoiceExtractionResult>('/api/voice/extract', {
      method: 'POST',
      body: JSON.stringify({ transcript, target_mode: targetMode, astronaut_id: astronautId }),
    }),

  // Reports & Datasets
  getDailyReport: (astronautId?: number) =>
    apiFetch<DailyReport>(`/api/reports/daily${astronautId ? `?astronaut_id=${astronautId}` : ''}`),
  listDatasets: () =>
    apiFetch<{ datasets: DatasetEntry[]; research_documents: Array<Record<string, unknown>> }>('/api/datasets'),
};
