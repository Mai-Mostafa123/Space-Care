import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HazardsPage } from '../pages/HazardsPage';
import { TransparencyPage } from '../pages/TransparencyPage';
import { ProfilesPage } from '../pages/ProfilesPage';
import { AnomaliesPage } from '../pages/AnomaliesPage';
import { VoicePage } from '../pages/VoicePage';
import { AssistantPage } from '../pages/AssistantPage';
import { api } from '../services/apiAdapter';
import type { AnomalyAlert, Astronaut, SystemStatus } from '../types/domain';

const MOCK_CREW: Astronaut[] = [
  {
    id: 1,
    call_sign: 'CDR-01',
    full_name: 'Elena Vance',
    role: 'Mission Commander',
    mission_name: 'ARTEMIS-SIM-04',
    age_group: '35-39',
    blood_type: 'O+',
    mission_day: 30,
    mission_duration_days: 180,
    avatar_url: '',
    notes: 'Synthetic baseline profile',
    data_source: 'SYNTHETIC',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-30T00:00:00Z',
  },
];

const MOCK_ANOMALIES: AnomalyAlert[] = [
  {
    id: 11,
    astronaut_id: 1,
    call_sign: 'CDR-01',
    detected_at: '2026-01-20T08:00:00Z',
    variables_involved: 'heart_rate_bpm, sleep_duration_hrs',
    observed_values: { heart_rate_bpm: 86, sleep_duration_hrs: 4.5 },
    baseline_reference: { heart_rate_bpm: { mean: 62, std: 2.1, median: 62, n_samples: 12 } },
    deviation_description: 'HR elevated above personal baseline',
    detection_method: 'MULTIVARIATE_BASELINE_DISTANCE',
    anomaly_score: 0.72,
    confidence_level: 'HIGH',
    severity_tier: 'ELEVATED',
    status: 'ACTIVE',
    data_source: 'SYNTHETIC',
    explanation: 'Detected elevated resting HR paired with reduced sleep relative to personal baseline.',
    uncertainty_statement: 'Decision-support only. Not a clinical diagnosis.',
    acknowledged_at: null,
  },
];

const MOCK_STATUS: SystemStatus = {
  runtime_mode: 'NODE_PREVIEW_RUNTIME',
  api_version: '1.0.0',
  database_connected: true,
  database_path: 'local.db',
  offline_ready: true,
  ollama: {
    connected: false,
    base_url: 'http://localhost:11434',
    available_models: [],
    preferred_model: 'qwen2.5:3b',
    embed_model: 'nomic-embed-text',
  },
  counts: {
    astronauts: 3,
    health_records: 90,
    environmental_records: 30,
    active_anomalies: 1,
    datasets: 9,
    research_documents: 7,
  },
};

describe('Aegis Orbital Health — Frontend Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Five NASA Spaceflight Hazards page and switches hazard tabs cleanly', () => {
    render(<HazardsPage />);
    expect(screen.getByText(/Five NASA Human Spaceflight Hazards Analytical Matrix/i)).toBeInTheDocument();
    expect(screen.getByText(/NASA HRP Hazard 01/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Distance from Earth'));
    expect(screen.getByText(/NASA HRP Hazard 03/i)).toBeInTheDocument();
    expect(screen.getByText(/Exploration Medical Capability/i)).toBeInTheDocument();
  });

  it('renders Data Transparency registry and filters by REAL vs SIMULATED', async () => {
    vi.spyOn(api, 'listDatasets').mockResolvedValueOnce({
      datasets: [
        {
          dataset_identifier: 'OSD-569',
          name: 'Whole Blood Measurements from SpaceX Inspiration4',
          original_source: 'NASA OSDR',
          source_classification: 'REAL',
          variables: ['RNA-seq', 'CBC'],
          file_format: 'ISA-Tab',
          record_count: '4 crew',
          subject_count: 4,
          time_coverage: 'September 2021',
          accessibility: 'Processed open',
          download_or_api_method: 'https://osdr.nasa.gov/',
          license_info: 'NASA Open Science',
          relevance_notes: 'Longitudinal baseline reference',
          limitations: '3-day LEO mission',
        },
        {
          dataset_identifier: 'AEGIS-SYNTH-30D',
          name: 'Synthetic Benchmark',
          original_source: 'Local Generator',
          source_classification: 'SIMULATED',
          variables: ['heart_rate_bpm'],
          file_format: 'JSON',
          record_count: '90',
          subject_count: 3,
          time_coverage: '30 days',
          accessibility: 'Local',
          download_or_api_method: 'Local JSON',
          license_info: 'Apache-2.0',
          relevance_notes: 'Benchmark',
          limitations: 'Synthetic only',
        },
      ],
      research_documents: [],
    });

    render(<TransparencyPage />);
    await waitFor(() => expect(screen.getByText('OSD-569')).toBeInTheDocument());
    expect(screen.getByText('AEGIS-SYNTH-30D')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'REAL' }));
    expect(screen.getByText('OSD-569')).toBeInTheDocument();
    expect(screen.queryByText('AEGIS-SYNTH-30D')).not.toBeInTheDocument();
  });

  it('renders ProfilesPage and toggles Add Astronaut modal cleanly', async () => {
    vi.spyOn(api, 'getAstronautDetail').mockResolvedValueOnce({
      profile: MOCK_CREW[0],
      history: [{ id: 1, astronaut_id: 1, field_changed: 'PROFILE_CREATED', previous_value: '', new_value: 'CDR-01', change_source: 'SEED', changed_at: '2026-01-01T00:00:00Z' }],
      recent_health_count: 30,
    });

    render(
      <ProfilesPage
        astronauts={MOCK_CREW}
        selectedAstronautId={1}
        onSelectAstronaut={vi.fn()}
        onRefresh={async () => {}}
        onNavigate={vi.fn()}
      />
    );
    await waitFor(() => expect(screen.getByText('Profile Audit History')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Add Astronaut/i }));
    expect(screen.getByText(/Create Manual Astronaut Profile/i)).toBeInTheDocument();
  });

  it('renders AnomaliesPage evaluation metrics and triggers Acknowledge action', async () => {
    vi.spyOn(api, 'getMLEvaluation').mockResolvedValueOnce({
      evaluation_scope: 'SYNTHETIC_BENCHMARK_OUT_OF_SAMPLE',
      total_samples: 54,
      positive_ground_truth: 6,
      precision: 1,
      recall: 1,
      f1_score: 1,
      false_positive_rate: 0,
      confusion_matrix: { tp: 6, fp: 0, fn: 0, tn: 48 },
    });
    const ackSpy = vi.spyOn(api, 'updateAnomalyStatus').mockResolvedValueOnce({
      id: 11,
      status: 'ACKNOWLEDGED',
    });

    render(<AnomaliesPage anomalies={MOCK_ANOMALIES} selectedAstronautId={1} onRefresh={async () => {}} />);
    await waitFor(() => expect(screen.getByText(/54 daily crew observations/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Acknowledge' }));
    await waitFor(() => expect(ackSpy).toHaveBeenCalledWith(11, 'ACKNOWLEDGED'));
  });

  it('runs VoicePage extraction and requires explicit user confirmation before save', async () => {
    vi.spyOn(api, 'extractVoiceTranscript').mockResolvedValueOnce({
      transcript: 'Heart rate is 68, SpO2 98.4',
      target_mode: 'health_log',
      extracted_fields: { heart_rate_bpm: 68, spo2_pct: 98.4 },
      uncertain_fields: ['sleep_duration_hrs'],
      validation_passed: true,
      transcription_errors: [],
      requires_confirmation: true,
    });

    render(<VoicePage astronauts={MOCK_CREW} selectedAstronautId={1} onRefresh={async () => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Extract & Validate Structured Fields/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Confirm & Save to Database/i })).toBeInTheDocument());
    expect(screen.getByText(/Explicit confirmation required/i)).toBeInTheDocument();
  });

  it('records voice audio via MediaRecorder and exposes playback & Whisper upload controls', async () => {
    const stopTrack = vi.fn();
    const mockStream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
    });

    class MockMediaRecorder {
      state = 'inactive';
      mimeType = 'audio/webm';
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      static isTypeSupported() {
        return true;
      }
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        this.ondataavailable?.({ data: new Blob(['audio-bytes'], { type: 'audio/webm' }) });
        this.onstop?.();
      }
    }
    vi.stubGlobal('MediaRecorder', MockMediaRecorder);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-audio-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const transcribeSpy = vi.spyOn(api, 'transcribeAudio').mockResolvedValueOnce({
      success: true,
      transcript: 'Heart rate is 70, SpO2 99',
      engine: 'faster-whisper',
      error: null,
      extracted: null,
    });

    render(<VoicePage astronauts={MOCK_CREW} selectedAstronautId={1} onRefresh={async () => {}} />);
    expect(screen.getByTestId('mic-status-bar')).toHaveTextContent(/MIC STATUS: IDLE/i);

    fireEvent.click(screen.getByRole('button', { name: /Start Voice Recording/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Stop Recording/i })).toBeInTheDocument());
    expect(screen.getByTestId('mic-status-bar')).toHaveTextContent(/MIC STATUS: ACTIVE/i);
    expect(screen.getByTestId('mic-status-bar')).toHaveTextContent(/Granted/i);
    expect(screen.getByTestId('voice-waveform')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Stop Recording/i }));
    await waitFor(() => expect(screen.getByText(/Recorded Voice Clip/i)).toBeInTheDocument());
    expect(stopTrack).toHaveBeenCalled();
    expect(transcribeSpy).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('mic-status-bar')).toHaveTextContent(/MIC STATUS: IDLE/i));
    await waitFor(() => expect((screen.getByLabelText(/Editable Transcript Preview/i) as HTMLTextAreaElement).value).toBe('Heart rate is 70, SpO2 99'));
  });

  it('allows editing Voice Log permissions with Allow / Do Not Allow buttons', async () => {
    window.localStorage.clear();
    const stopTrack = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }),
        enumerateDevices: vi.fn().mockResolvedValue([{ kind: 'audioinput', deviceId: 'usb-mic-1', label: 'Headset Mic' }]),
      },
    });

    const { within } = await import('@testing-library/react');
    render(<VoicePage astronauts={MOCK_CREW} selectedAstronautId={1} onRefresh={async () => {}} />);
    expect(screen.getByTestId('voice-permissions-panel')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Grant \/ Test Browser Mic Access/i }));
    await waitFor(() => expect(screen.getByTestId('mic-status-bar')).toHaveTextContent(/Granted/i));
    await waitFor(() => expect(screen.getByRole('option', { name: 'Headset Mic' })).toBeInTheDocument());

    const editGroup = screen.getByRole('group', { name: 'Voice Log Edit Permission' });
    fireEvent.click(within(editGroup).getByRole('button', { name: 'Do Not Allow' }));
    expect(screen.getByTestId('mic-status-bar')).toHaveTextContent(/REVIEW-ONLY PERMISSION MODE/i);
    expect(screen.getByLabelText(/Editable Transcript Preview/i)).toHaveAttribute('readonly');
    fireEvent.click(within(editGroup).getByRole('button', { name: 'Allow' }));
    expect(screen.getByLabelText(/Editable Transcript Preview/i)).not.toHaveAttribute('readonly');

    const micGroup = screen.getByRole('group', { name: 'Microphone Capture Permission' });
    fireEvent.click(within(micGroup).getByRole('button', { name: 'Do Not Allow' }));
    expect(screen.getByTestId('mic-status-bar')).toHaveTextContent(/OPERATOR CAPTURE DISABLED/i);
    expect(screen.getByRole('button', { name: /Mic Disabled by Permission/i })).toBeDisabled();
    fireEvent.click(within(micGroup).getByRole('button', { name: 'Allow' }));
    expect(screen.getByRole('button', { name: /Start Voice Recording/i })).not.toBeDisabled();
  });

  it('renders AssistantPage offline notice and submits grounded query', async () => {
    vi.spyOn(api, 'getAssistantHistory').mockResolvedValueOnce([]);
    const querySpy = vi.spyOn(api, 'queryAssistant').mockResolvedValueOnce({
      answer: 'Grounded local NASA retrieval summary.',
      citations: [
        {
          doc_id: 'NASA-HRP-RAD',
          title: 'Risk of Radiation Carcinogenesis',
          source_org: 'NASA HRP',
          url: 'https://humanresearchroadmap.nasa.gov/',
          hazard_category: 'Space Radiation',
          verified_reference: 'NASA HRP Evidence Report',
          excerpt: 'Galactic cosmic rays pose longitudinal risks.',
          score: 0.42,
        },
      ],
      context_records: [],
      inference_engine: 'Local Grounded Retrieval (Ollama Offline)',
      ollama_connected: false,
      uncertainty_note: 'Decision-support only.',
    });

    render(<AssistantPage astronauts={MOCK_CREW} selectedAstronautId={1} systemStatus={MOCK_STATUS} />);
    expect(screen.getByText(/Local Ollama Service Not Detected/i)).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/Ask about crew baselines/i);
    fireEvent.change(input, { target: { value: 'How does radiation affect crew?' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => expect(querySpy).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/Grounded NASA Citations \(1\)/i)).toBeInTheDocument());
  });
});
