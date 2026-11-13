import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  FileAudio,
  Mic,
  MicOff,
  Settings2,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { api } from '../services/apiAdapter';
import type { Astronaut, VoiceExtractionResult } from '../types/domain';

interface VoicePageProps {
  astronauts: Astronaut[];
  selectedAstronautId: number | null;
  onRefresh: () => Promise<void>;
}

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type MicCapturePhase = 'idle' | 'processing' | 'active';
type BrowserPermState = 'granted' | 'prompt' | 'denied' | 'unsupported' | 'unknown';
type VoiceAccessMode = 'read_write' | 'review_only';

interface VoiceLogPermissions {
  allowMicCapture: boolean;
  allowAudioRetention: boolean;
  allowLocalTranscription: boolean;
  accessMode: VoiceAccessMode;
  selectedDeviceId: string;
}

const PERM_STORAGE_KEY = 'aegis_voice_permissions_v1';
const DEFAULT_PERMISSIONS: VoiceLogPermissions = {
  allowMicCapture: true,
  allowAudioRetention: true,
  allowLocalTranscription: true,
  accessMode: 'read_write',
  selectedDeviceId: 'default',
};

const WAVEFORM_BAR_COUNT = 28;
const IDLE_WAVEFORM = Array.from({ length: WAVEFORM_BAR_COUNT }, () => 8);

function loadStoredPermissions(): VoiceLogPermissions {
  try {
    const raw = window.localStorage.getItem(PERM_STORAGE_KEY);
    if (!raw) return DEFAULT_PERMISSIONS;
    const parsed = JSON.parse(raw) as Partial<VoiceLogPermissions>;
    return {
      allowMicCapture: parsed.allowMicCapture ?? true,
      allowAudioRetention: parsed.allowAudioRetention ?? true,
      allowLocalTranscription: parsed.allowLocalTranscription ?? true,
      accessMode: parsed.accessMode === 'review_only' ? 'review_only' : 'read_write',
      selectedDeviceId: parsed.selectedDeviceId || 'default',
    };
  } catch {
    return DEFAULT_PERMISSIONS;
  }
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const VoicePage: React.FC<VoicePageProps> = ({
  astronauts,
  selectedAstronautId,
  onRefresh,
}) => {
  const targetAstronautId = selectedAstronautId ?? astronauts[0]?.id ?? 1;
  const [targetMode, setTargetMode] = useState<'health_log' | 'profile_update'>('health_log');
  const [recording, setRecording] = useState(false);
  const [micPhase, setMicPhase] = useState<MicCapturePhase>('idle');
  const [browserPerm, setBrowserPerm] = useState<BrowserPermState>('unknown');
  const [permissions, setPermissions] = useState<VoiceLogPermissions>(loadStoredPermissions);
  const [showPermEditor, setShowPermEditor] = useState(true);
  const [audioInputs, setAudioInputs] = useState<Array<{ deviceId: string; label: string }>>([]);

  const [recordSeconds, setRecordSeconds] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const [waveformBars, setWaveformBars] = useState<number[]>(IDLE_WAVEFORM);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [speechEngineState, setSpeechEngineState] = useState<string>('Idle');
  const [transcribing, setTranscribing] = useState(false);

  const [transcript, setTranscript] = useState(
    'Heart rate is 68, SpO2 98.4, slept 7.2 hours, exercise 85 minutes, stress level 3, mood 8.'
  );
  const [extracted, setExtracted] = useState<VoiceExtractionResult | null>(null);
  const [editableFields, setEditableFields] = useState<Record<string, string>>({});
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const levelRafRef = useRef<number | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const speechCapturedRef = useRef<boolean>(false);
  const permissionsRef = useRef<VoiceLogPermissions>(permissions);
  const latestAudioUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
  const isReadOnly = permissions.accessMode === 'review_only';

  useEffect(() => {
    permissionsRef.current = permissions;
    try {
      window.localStorage.setItem(PERM_STORAGE_KEY, JSON.stringify(permissions));
    } catch {
      // ignore storage restrictions
    }
  }, [permissions]);

  useEffect(() => {
    latestAudioUrlRef.current = recordedAudioUrl;
    return () => {
      if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
    };
  }, [recordedAudioUrl]);

  const refreshAudioDevices = async () => {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.enumerateDevices !== 'function') return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices
        .filter((d) => d.kind === 'audioinput')
        .map((d, idx) => ({
          deviceId: d.deviceId || `mic-${idx}`,
          label: d.label || `Microphone Input ${idx + 1}`,
        }));
      setAudioInputs(mics);
    } catch {
      // ignore enumerateDevices errors
    }
  };

  // Query and subscribe to browser microphone permission status persistently
  useEffect(() => {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      setBrowserPerm('unsupported');
      return;
    }

    let cancelled = false;
    let permStatusObj: PermissionStatus | null = null;

    if (navigator.permissions && typeof navigator.permissions.query === 'function') {
      navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then((status) => {
          if (cancelled) return;
          permStatusObj = status;
          setBrowserPerm(status.state as BrowserPermState);
          if (status.state === 'granted') void refreshAudioDevices();
          status.onchange = () => {
            if (!cancelled) {
              setBrowserPerm(status.state as BrowserPermState);
              if (status.state === 'granted') void refreshAudioDevices();
            }
          };
        })
        .catch(() => {
          if (!cancelled) setBrowserPerm('prompt');
        });
    } else {
      setBrowserPerm('prompt');
    }

    return () => {
      cancelled = true;
      if (permStatusObj) permStatusObj.onchange = null;
    };
  }, []);

  const cleanupCaptureResources = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (levelRafRef.current !== null) {
      window.cancelAnimationFrame(levelRafRef.current);
      levelRafRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore stop errors
      }
      recognitionRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setMicLevel(0);
    setWaveformBars(IDLE_WAVEFORM);
  };

  // Only tear down capture hardware on actual component unmount
  useEffect(() => {
    return () => {
      cleanupCaptureResources();
      if (latestAudioUrlRef.current) URL.revokeObjectURL(latestAudioUrlRef.current);
    };
  }, []);

  const requestOrVerifyMicPermission = async () => {
    setErrorMsg('');
    setStatusMsg('');
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      setBrowserPerm('unsupported');
      setErrorMsg('Browser mediaDevices.getUserMedia is unavailable in this environment.');
      return;
    }

    setMicPhase('processing');
    try {
      const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      testStream.getTracks().forEach((t) => t.stop());
      setBrowserPerm('granted');
      setPermissions((prev) => ({ ...prev, allowMicCapture: true }));
      await refreshAudioDevices();
      setStatusMsg('Browser microphone access granted and verified.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/denied|notallowed|permission/i.test(msg)) {
        setBrowserPerm('denied');
        setErrorMsg(
          'Browser or iframe microphone permission is blocked. Enable Microphone in your browser site permissions (Lock/Tune icon) or open this app in a standalone tab, then click Re-Verify.'
        );
      } else {
        setErrorMsg(`Unable to verify microphone access: ${msg}`);
      }
    } finally {
      setMicPhase('idle');
    }
  };

  const updatePermission = <K extends keyof VoiceLogPermissions>(key: K, value: VoiceLogPermissions[K]) => {
    setPermissions((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'allowMicCapture' && value === false && recording) {
        stopRecording();
      }
      if (key === 'allowAudioRetention' && value === false) {
        setRecordedAudioUrl(null);
        setRecordedBlob(null);
      }
      return next;
    });
    setStatusMsg('Voice Log permissions updated.');
  };

  const resetPermissionsToDefault = () => {
    setPermissions(DEFAULT_PERMISSIONS);
    setStatusMsg('Voice Log permissions reset to defaults (Read & Write, Capture Enabled).');
  };

  const sendAudioToLocalWhisper = async (blob: Blob) => {
    if (!permissionsRef.current.allowLocalTranscription) {
      setStatusMsg('Audio captured. Local Whisper upload is disabled by Voice Log permissions.');
      setMicPhase('idle');
      return;
    }
    setTranscribing(true);
    setMicPhase('processing');
    try {
      const resp = await api.transcribeAudio(blob, targetMode, targetAstronautId);
      if (resp.success && resp.transcript) {
        setTranscript(resp.transcript);
        setStatusMsg(`Transcribed locally via ${resp.engine}. Review transcript and click Extract.`);
        if (resp.extracted) {
          setExtracted(resp.extracted);
          const stringified: Record<string, string> = {};
          for (const [k, v] of Object.entries(resp.extracted.extracted_fields)) {
            stringified[k] = v !== null && v !== undefined ? String(v) : '';
          }
          setEditableFields(stringified);
        }
      } else {
        setStatusMsg(
          resp.error
            ? `Audio recorded (${(blob.size / 1024).toFixed(1)} KB). ${resp.error}`
            : `Audio recorded (${(blob.size / 1024).toFixed(1)} KB). Review or edit transcript below.`
        );
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Audio upload failed');
    } finally {
      setTranscribing(false);
      setMicPhase('idle');
    }
  };

  const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg('');
    setStatusMsg('');
    if (permissions.allowAudioRetention) {
      setRecordedBlob(file);
      setRecordedAudioUrl(URL.createObjectURL(file));
    }
    setSpeechEngineState('Audio File Loaded');
    if (permissions.allowLocalTranscription) {
      void sendAudioToLocalWhisper(file);
    } else {
      setStatusMsg(`Loaded audio file ${file.name} (${(file.size / 1024).toFixed(1)} KB).`);
    }
    e.target.value = '';
  };

  const stopRecording = () => {
    setMicPhase('processing');
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      cleanupCaptureResources();
      setRecording(false);
      setMicPhase('idle');
    }
  };

  const toggleRecording = async () => {
    setErrorMsg('');
    setStatusMsg('');

    if (recording) {
      stopRecording();
      return;
    }

    if (isReadOnly) {
      setErrorMsg('Voice Log is currently in Review-Only mode. Switch Edit Permission to Read & Write to record or save logs.');
      setShowPermEditor(true);
      return;
    }

    if (!permissions.allowMicCapture) {
      setErrorMsg('Microphone recording is disabled in Voice Log Permissions. Enable "Allow Microphone Capture" above to record.');
      setShowPermEditor(true);
      return;
    }

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      setBrowserPerm('unsupported');
      setMicPhase('idle');
      setErrorMsg(
        'Microphone capture (navigator.mediaDevices.getUserMedia) is unavailable in this browser context. You can upload an audio clip or edit the transcript directly.'
      );
      return;
    }

    setMicPhase('processing');
    setSpeechEngineState('Requesting Microphone Permission...');

    try {
      const audioConstraints: MediaTrackConstraints | boolean =
        permissions.selectedDeviceId && permissions.selectedDeviceId !== 'default'
          ? { deviceId: { exact: permissions.selectedDeviceId } }
          : true;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      mediaStreamRef.current = stream;
      setBrowserPerm('granted');
      void refreshAudioDevices();

      setRecordedAudioUrl(null);
      setRecordedBlob(null);
      chunksRef.current = [];
      speechCapturedRef.current = false;
      setRecordSeconds(0);

      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        try {
          const ctx = new AudioCtx();
          audioCtxRef.current = ctx;
          const src = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 128;
          analyser.smoothingTimeConstant = 0.72;
          src.connect(analyser);

          const freqData = new Uint8Array(analyser.frequencyBinCount);
          const timeData = new Uint8Array(analyser.fftSize);

          const tickWaveform = () => {
            analyser.getByteFrequencyData(freqData);
            analyser.getByteTimeDomainData(timeData);

            let sumSq = 0;
            for (let i = 0; i < timeData.length; i++) {
              const norm = (timeData[i] - 128) / 128;
              sumSq += norm * norm;
            }
            const rms = Math.sqrt(sumSq / Math.max(1, timeData.length));
            const avgFreq = freqData.reduce((acc, v) => acc + v, 0) / Math.max(1, freqData.length);
            const levelPct = Math.min(100, Math.round(Math.max(rms * 240, (avgFreq / 128) * 100)));
            setMicLevel(levelPct);

            const nextBars: number[] = [];
            const binStep = Math.max(1, Math.floor(freqData.length / WAVEFORM_BAR_COUNT));
            for (let b = 0; b < WAVEFORM_BAR_COUNT; b++) {
              const idx = Math.min(freqData.length - 1, b * binStep);
              const tdIdx = Math.min(timeData.length - 1, Math.floor((b / WAVEFORM_BAR_COUNT) * timeData.length));
              const waveDeviation = Math.abs(timeData[tdIdx] - 128) / 128;
              const freqEnergy = freqData[idx] / 255;
              const barPct = Math.min(100, Math.max(10, Math.round((freqEnergy * 0.7 + waveDeviation * 0.9) * 100)));
              nextBars.push(barPct);
            }
            setWaveformBars(nextBars);

            levelRafRef.current = window.requestAnimationFrame(tickWaveform);
          };
          tickWaveform();
        } catch {
          // AudioContext meter is optional
        }
      }

      if (typeof MediaRecorder !== 'undefined') {
        const mimeOptions = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
        const supportedMime = mimeOptions.find((m) => MediaRecorder.isTypeSupported?.(m));
        const recorder = supportedMime
          ? new MediaRecorder(stream, { mimeType: supportedMime })
          : new MediaRecorder(stream);

        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) {
            chunksRef.current.push(ev.data);
          }
        };

        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          cleanupCaptureResources();
          setRecording(false);
          if (blob.size > 0) {
            if (permissionsRef.current.allowAudioRetention) {
              setRecordedBlob(blob);
              setRecordedAudioUrl(URL.createObjectURL(blob));
            } else {
              setRecordedBlob(null);
              setRecordedAudioUrl(null);
            }
            setSpeechEngineState('Audio Captured');
            if (!speechCapturedRef.current && permissionsRef.current.allowLocalTranscription) {
              void sendAudioToLocalWhisper(blob);
            } else {
              setMicPhase('idle');
              setStatusMsg(
                permissionsRef.current.allowAudioRetention
                  ? `Recorded ${(blob.size / 1024).toFixed(1)} KB audio. Review transcript before saving.`
                  : 'Ephemeral voice session finished (audio clip discarded per Voice Log privacy permission).'
              );
            }
          } else {
            setMicPhase('idle');
          }
        };

        mediaRecorderRef.current = recorder;
        recorder.start(250);
      }

      const win = window as unknown as {
        SpeechRecognition?: new () => BrowserSpeechRecognition;
        webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
      };
      const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

      if (SpeechRec) {
        try {
          const rec = new SpeechRec();
          rec.lang = 'en-US';
          rec.continuous = true;
          rec.interimResults = true;
          rec.onresult = (event) => {
            let text = '';
            for (let i = 0; i < event.results.length; i++) {
              text += event.results[i][0].transcript + ' ';
            }
            const clean = text.trim();
            if (clean) {
              speechCapturedRef.current = true;
              setTranscript(clean);
            }
          };
          rec.onerror = () => {
            setSpeechEngineState('Recording Audio (Live STT unavailable — Whisper/Manual fallback)');
          };
          rec.onend = () => {
            recognitionRef.current = null;
          };
          recognitionRef.current = rec;
          rec.start();
          setSpeechEngineState('Recording Audio + Live Browser STT');
        } catch {
          setSpeechEngineState('Recording Audio (MediaRecorder)');
        }
      } else {
        setSpeechEngineState('Recording Audio (MediaRecorder)');
      }

      timerRef.current = window.setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
      setRecording(true);
      setMicPhase('active');
    } catch (err) {
      cleanupCaptureResources();
      setRecording(false);
      setMicPhase('idle');
      const msg = err instanceof Error ? err.message : String(err);
      if (/denied|notallowed|permission/i.test(msg)) {
        setBrowserPerm('denied');
        setSpeechEngineState('Permission Denied');
        setErrorMsg('Microphone permission was denied by the browser or host iframe. Check the Voice Log Permissions panel above to re-verify or upload an audio clip.');
      } else {
        setSpeechEngineState('Capture Error');
        setErrorMsg(`Unable to access microphone: ${msg}`);
      }
    }
  };

  const clearRecording = () => {
    setRecordedAudioUrl(null);
    setRecordedBlob(null);
    setRecordSeconds(0);
    setMicPhase('idle');
    setSpeechEngineState('Idle');
  };

  const handleExtract = async () => {
    setErrorMsg('');
    setStatusMsg('');
    try {
      const res = await api.extractVoiceTranscript(transcript, targetMode, targetAstronautId);
      setExtracted(res);
      const stringified: Record<string, string> = {};
      for (const [k, v] of Object.entries(res.extracted_fields)) {
        stringified[k] = v !== null && v !== undefined ? String(v) : '';
      }
      setEditableFields(stringified);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Extraction failed');
    }
  };

  const handleConfirmSave = async () => {
    if (!extracted || isReadOnly) return;
    setErrorMsg('');
    setStatusMsg('');
    try {
      if (targetMode === 'health_log') {
        await api.createHealth({
          astronaut_id: targetAstronautId,
          heart_rate_bpm: editableFields.heart_rate_bpm ? Number(editableFields.heart_rate_bpm) : null,
          spo2_pct: editableFields.spo2_pct ? Number(editableFields.spo2_pct) : null,
          sleep_duration_hrs: editableFields.sleep_duration_hrs ? Number(editableFields.sleep_duration_hrs) : null,
          activity_minutes: editableFields.activity_minutes ? Number(editableFields.activity_minutes) : null,
          stress_score: editableFields.stress_score ? Number(editableFields.stress_score) : null,
          mood_score: editableFields.mood_score ? Number(editableFields.mood_score) : null,
          mood_notes: editableFields.mood_notes || transcript,
          data_source: 'MANUAL',
        });
        setStatusMsg('Confirmed and saved voice-extracted health record (tagged MANUAL).');
      } else {
        await api.updateAstronaut(targetAstronautId, {
          role: editableFields.role || undefined,
          mission_name: editableFields.mission_name || undefined,
          mission_day: editableFields.mission_day ? Number(editableFields.mission_day) : undefined,
          notes: editableFields.notes || undefined,
          change_source: 'VOICE_CONFIRMED',
        });
        setStatusMsg('Confirmed and updated astronaut profile with VOICE_CONFIRMED audit log.');
      }
      setExtracted(null);
      await onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const phaseLabel = !permissions.allowMicCapture
    ? 'IDLE — OPERATOR CAPTURE DISABLED'
    : isReadOnly
    ? 'IDLE — REVIEW-ONLY PERMISSION MODE'
    : micPhase === 'active'
    ? 'ACTIVE — MICROPHONE STREAM LIVE'
    : micPhase === 'processing'
    ? 'PROCESSING — INITIALIZING / TRANSCRIBING'
    : 'IDLE — READY FOR VOICE CAPTURE';

  const permLabel =
    browserPerm === 'granted'
      ? 'Granted'
      : browserPerm === 'prompt'
      ? 'Prompt on Record'
      : browserPerm === 'denied'
      ? 'Denied'
      : browserPerm === 'unsupported'
      ? 'Unsupported'
      : 'Checking';

  const phaseStyle =
    micPhase === 'active'
      ? 'border-emerald-500/60 bg-emerald-950/30 text-emerald-300'
      : micPhase === 'processing'
      ? 'border-amber-500/60 bg-amber-950/30 text-amber-300'
      : !permissions.allowMicCapture || isReadOnly
      ? 'border-rose-800/70 bg-rose-950/20 text-rose-200'
      : 'border-slate-800 bg-[#0D111A] text-slate-300';

  const dotStyle =
    micPhase === 'active'
      ? 'bg-emerald-400 animate-pulse'
      : micPhase === 'processing'
      ? 'bg-amber-400 animate-pulse'
      : !permissions.allowMicCapture || isReadOnly || browserPerm === 'denied' || browserPerm === 'unsupported'
      ? 'bg-rose-400'
      : 'bg-slate-500';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-100">
            Voice-to-Structured-Data Entry
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Pipeline: Microphone Audio -&gt; Local Speech-to-Text -&gt; Structured JSON -&gt; Validation -&gt; Explicit User Review -&gt; SQLite.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#0D111A] border border-slate-800 rounded-md text-xs">
          <button
            type="button"
            onClick={() => {
              setTargetMode('health_log');
              setExtracted(null);
            }}
            className={`px-3 py-1.5 rounded transition-colors ${
              targetMode === 'health_log' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Health &amp; Mood Log
          </button>
          <button
            type="button"
            onClick={() => {
              setTargetMode('profile_update');
              setExtracted(null);
            }}
            className={`px-3 py-1.5 rounded transition-colors ${
              targetMode === 'profile_update' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Profile Update
          </button>
        </div>
      </div>

      {/* Persistent Microphone Permission & Capture Status Bar */}
      <div className="space-y-3">
        <div
          role="status"
          aria-live="polite"
          data-testid="mic-status-bar"
          className={`px-4 py-2.5 rounded-md border flex flex-wrap items-center justify-between gap-3 text-xs font-mono transition-colors ${phaseStyle}`}
        >
          <div className="flex items-center gap-2.5">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotStyle}`} aria-hidden="true" />
            <span className="font-semibold tracking-wide">MIC STATUS: {phaseLabel}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <span>
              Browser Permission:{' '}
              <strong
                className={
                  browserPerm === 'granted'
                    ? 'text-emerald-300'
                    : browserPerm === 'denied' || browserPerm === 'unsupported'
                    ? 'text-rose-300'
                    : 'text-slate-200'
                }
              >
                {permLabel}
              </strong>
            </span>
            <span className="text-slate-400">
              Mode: {isReadOnly ? 'Review-Only' : 'Read & Write'} · Capture:{' '}
              {permissions.allowMicCapture ? 'Allowed' : 'Disabled'}
            </span>
            <button
              type="button"
              onClick={() => setShowPermEditor((v) => !v)}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 flex items-center gap-1.5 transition-colors"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>{showPermEditor ? 'Hide Permissions' : 'Edit Permissions'}</span>
            </button>
          </div>
        </div>

        {/* Editable Voice Log Permissions Panel */}
        {showPermEditor && (
          <section
            data-testid="voice-permissions-panel"
            className="bg-[#0D111A] border border-cyan-500/40 rounded-lg p-5 space-y-4 text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <h3 className="font-display text-sm font-semibold text-slate-100">
                  Voice Log Permissions &amp; Access Controls
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={micPhase === 'processing'}
                  onClick={requestOrVerifyMicPermission}
                  className="px-3 py-1.5 rounded-md bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 font-medium disabled:opacity-50"
                >
                  {browserPerm === 'granted' ? 'Re-Verify Browser Mic & Devices' : 'Grant / Test Browser Mic Access'}
                </button>
                <button
                  type="button"
                  onClick={resetPermissionsToDefault}
                  className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300"
                >
                  Reset Defaults
                </button>
              </div>
            </div>

            {browserPerm === 'denied' && (
              <div className="p-3 bg-rose-950/30 border border-rose-800/70 rounded-md text-rose-200 flex flex-wrap items-center justify-between gap-3 leading-relaxed">
                <span>
                  Browser/iframe microphone access is currently <strong>Denied</strong>. Allow <strong>Microphone</strong> in your browser&apos;s address-bar site settings, or open this page in a standalone browser tab to grant access directly.
                </span>
                {isInIframe && (
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded bg-rose-600/30 hover:bg-rose-600/40 border border-rose-500/50 text-rose-100 font-mono flex items-center gap-1.5 shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Standalone Tab</span>
                  </a>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* 1. Voice Log Edit & Save Permission */}
              <div className="p-3.5 bg-[#07090E] border border-slate-800 rounded-md flex flex-col justify-between gap-3">
                <div>
                  <div className="font-medium text-slate-100">Edit &amp; Save Voice Log</div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Allow editing transcripts, fields, and committing entries to SQLite.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="Voice Log Edit Permission">
                  <button
                    type="button"
                    aria-pressed={!isReadOnly}
                    onClick={() => updatePermission('accessMode', 'read_write')}
                    className={`py-1.5 px-2 rounded text-[11px] font-mono border transition-colors ${
                      !isReadOnly
                        ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 font-semibold'
                        : 'bg-[#0D111A] border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Allow
                  </button>
                  <button
                    type="button"
                    aria-pressed={isReadOnly}
                    onClick={() => updatePermission('accessMode', 'review_only')}
                    className={`py-1.5 px-2 rounded text-[11px] font-mono border transition-colors ${
                      isReadOnly
                        ? 'bg-rose-500/20 border-rose-500/60 text-rose-300 font-semibold'
                        : 'bg-[#0D111A] border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Do Not Allow
                  </button>
                </div>
              </div>

              {/* 2. Microphone Capture Permission */}
              <div className="p-3.5 bg-[#07090E] border border-slate-800 rounded-md flex flex-col justify-between gap-3">
                <div>
                  <div className="font-medium text-slate-100">Microphone Capture</div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Allow opening hardware microphone streams for live voice recording.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="Microphone Capture Permission">
                  <button
                    type="button"
                    aria-pressed={permissions.allowMicCapture}
                    onClick={() => updatePermission('allowMicCapture', true)}
                    className={`py-1.5 px-2 rounded text-[11px] font-mono border transition-colors ${
                      permissions.allowMicCapture
                        ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 font-semibold'
                        : 'bg-[#0D111A] border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Allow
                  </button>
                  <button
                    type="button"
                    aria-pressed={!permissions.allowMicCapture}
                    onClick={() => updatePermission('allowMicCapture', false)}
                    className={`py-1.5 px-2 rounded text-[11px] font-mono border transition-colors ${
                      !permissions.allowMicCapture
                        ? 'bg-rose-500/20 border-rose-500/60 text-rose-300 font-semibold'
                        : 'bg-[#0D111A] border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Do Not Allow
                  </button>
                </div>
              </div>

              {/* 3. Retain Audio Playback Clip */}
              <div className="p-3.5 bg-[#07090E] border border-slate-800 rounded-md flex flex-col justify-between gap-3">
                <div>
                  <div className="font-medium text-slate-100">Retain Audio Clip</div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Keep recorded audio for playback/download, or discard immediately.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="Audio Clip Retention Permission">
                  <button
                    type="button"
                    aria-pressed={permissions.allowAudioRetention}
                    onClick={() => updatePermission('allowAudioRetention', true)}
                    className={`py-1.5 px-2 rounded text-[11px] font-mono border transition-colors ${
                      permissions.allowAudioRetention
                        ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 font-semibold'
                        : 'bg-[#0D111A] border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Allow
                  </button>
                  <button
                    type="button"
                    aria-pressed={!permissions.allowAudioRetention}
                    onClick={() => updatePermission('allowAudioRetention', false)}
                    className={`py-1.5 px-2 rounded text-[11px] font-mono border transition-colors ${
                      !permissions.allowAudioRetention
                        ? 'bg-rose-500/20 border-rose-500/60 text-rose-300 font-semibold'
                        : 'bg-[#0D111A] border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Do Not Allow
                  </button>
                </div>
              </div>

              {/* 4. Local Whisper API Upload */}
              <div className="p-3.5 bg-[#07090E] border border-slate-800 rounded-md flex flex-col justify-between gap-3">
                <div>
                  <div className="font-medium text-slate-100">Local Whisper API</div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Allow sending recorded audio chunks to <span className="font-mono">/api/voice/transcribe</span>.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="Local Whisper API Permission">
                  <button
                    type="button"
                    aria-pressed={permissions.allowLocalTranscription}
                    onClick={() => updatePermission('allowLocalTranscription', true)}
                    className={`py-1.5 px-2 rounded text-[11px] font-mono border transition-colors ${
                      permissions.allowLocalTranscription
                        ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 font-semibold'
                        : 'bg-[#0D111A] border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Allow
                  </button>
                  <button
                    type="button"
                    aria-pressed={!permissions.allowLocalTranscription}
                    onClick={() => updatePermission('allowLocalTranscription', false)}
                    className={`py-1.5 px-2 rounded text-[11px] font-mono border transition-colors ${
                      !permissions.allowLocalTranscription
                        ? 'bg-rose-500/20 border-rose-500/60 text-rose-300 font-semibold'
                        : 'bg-[#0D111A] border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Do Not Allow
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800/80">
              <div className="flex items-center gap-3 flex-1 min-w-[240px]">
                <label htmlFor="mic-device-select" className="text-slate-400 whitespace-nowrap">
                  Input Device:
                </label>
                <select
                  id="mic-device-select"
                  value={permissions.selectedDeviceId}
                  onChange={(e) => updatePermission('selectedDeviceId', e.target.value)}
                  className="flex-1 bg-[#07090E] border border-slate-700 rounded-md px-3 py-1.5 text-slate-100 font-mono"
                >
                  <option value="default">System Default Microphone</option>
                  {audioInputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <span className="text-[11px] text-slate-400">
                Safety Lock: Explicit human review before SQLite commit is always enforced.
              </span>
            </div>
          </section>
        )}
      </div>

      {statusMsg && (
        <div className="p-3 text-xs font-mono text-emerald-300 bg-emerald-950/30 border border-emerald-800/60 rounded-md flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 text-xs text-amber-200 bg-amber-950/30 border border-amber-800/60 rounded-md">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Step 1: Microphone Capture, Waveform Feedback Loop, Playback & Transcript Preview */}
        <section className="lg:col-span-6 bg-[#0D111A] border border-slate-800/90 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-slate-100">
              1. Voice Recording &amp; Transcription Preview
            </h3>
            <span className="font-mono text-xs text-slate-400">
              Crew ID {targetAstronautId}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={(micPhase === 'processing' && !recording) || (!recording && (!permissions.allowMicCapture || isReadOnly))}
              onClick={toggleRecording}
              className={`px-4 py-2.5 text-xs font-medium rounded-md flex items-center gap-2 transition-colors disabled:opacity-50 ${
                recording
                  ? 'bg-rose-600 text-white hover:bg-rose-500'
                  : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
              }`}
            >
              {recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>
                {recording
                  ? `Stop Recording (${formatDuration(recordSeconds)})`
                  : isReadOnly
                  ? 'Locked (Review-Only Mode)'
                  : !permissions.allowMicCapture
                  ? 'Mic Disabled by Permission'
                  : micPhase === 'processing'
                  ? 'Processing Audio...'
                  : 'Start Voice Recording'}
              </span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleAudioFileUpload}
              className="hidden"
            />
            <button
              type="button"
              disabled={isReadOnly}
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md flex items-center gap-1.5 disabled:opacity-50"
            >
              <FileAudio className="w-3.5 h-3.5" />
              <span>Upload Audio File</span>
            </button>

            <span className="text-xs font-mono text-slate-400">
              {recording ? `Live · ${formatDuration(recordSeconds)}` : `Mode: ${speechEngineState}`}
            </span>
          </div>

          {/* Visual Waveform Feedback Loop */}
          {recording && (
            <div
              data-testid="voice-waveform"
              className="p-3.5 bg-[#07090E] border border-emerald-500/40 rounded-md space-y-2.5"
            >
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-emerald-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" aria-hidden="true" />
                  LIVE AUDIO WAVEFORM FEEDBACK
                </span>
                <span className="text-slate-300 tabular-nums">
                  {formatDuration(recordSeconds)} · Input {micLevel}%
                </span>
              </div>

              <div
                className="h-14 flex items-center justify-between gap-1 px-2 bg-[#0B0E17] border border-slate-800/80 rounded"
                aria-label="Live microphone audio waveform"
              >
                {waveformBars.map((heightPct, idx) => (
                  <div
                    key={idx}
                    className="flex-1 bg-cyan-400/90 rounded-sm transition-all duration-75"
                    style={{ height: `${heightPct}%` }}
                  />
                ))}
              </div>
            </div>
          )}

          {recordedAudioUrl && (
            <div className="p-3 bg-[#07090E] border border-slate-800 rounded-md space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
                <span>
                  Recorded Voice Clip ({recordedBlob ? `${(recordedBlob.size / 1024).toFixed(1)} KB` : 'Ready'})
                </span>
                <div className="flex items-center gap-3">
                  <a
                    href={recordedAudioUrl}
                    download={`aegis-voice-crew-${targetAstronautId}.webm`}
                    className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Save Audio</span>
                  </a>
                  <button
                    type="button"
                    onClick={clearRecording}
                    className="text-slate-400 hover:text-rose-300 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Discard</span>
                  </button>
                </div>
              </div>
              <audio controls src={recordedAudioUrl} className="w-full h-9" />
              {recordedBlob && permissions.allowLocalTranscription && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={transcribing}
                    onClick={() => sendAudioToLocalWhisper(recordedBlob)}
                    className="px-3 py-1.5 text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{transcribing ? 'Transcribing...' : 'Transcribe via Local Whisper API'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          <div>
            <label htmlFor="voice-transcript" className="block text-xs text-slate-400 mb-1.5">
              Editable Transcript Preview
            </label>
            <textarea
              id="voice-transcript"
              rows={5}
              readOnly={isReadOnly}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              className="w-full bg-[#07090E] border border-slate-700 rounded-md p-3 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 read-only:opacity-60"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleExtract}
              className="px-4 py-2 text-xs font-medium bg-cyan-500 text-slate-950 rounded-md hover:bg-cyan-400"
            >
              Extract &amp; Validate Structured Fields
            </button>
          </div>
        </section>

        {/* Step 2: Review, Edit & Explicit Confirmation */}
        <section className="lg:col-span-6 bg-[#0D111A] border border-slate-800/90 rounded-lg p-5 space-y-4">
          <h3 className="font-display text-sm font-semibold text-slate-100">
            2. Review Extracted Fields &amp; Confirm Save
          </h3>

          {!extracted ? (
            <div className="py-16 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-md">
              Record audio or edit transcript, then click &quot;Extract &amp; Validate Structured Fields&quot; to inspect parsed JSON values before committing to SQLite.
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              {extracted.transcription_errors.length > 0 && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-md text-rose-200 space-y-1">
                  <div className="font-semibold">Validation Errors (Fix before saving):</div>
                  {extracted.transcription_errors.map((err, i) => (
                    <div key={i} className="font-mono">• {err}</div>
                  ))}
                </div>
              )}

              {extracted.uncertain_fields.length > 0 && (
                <div className="p-3 bg-amber-950/30 border border-amber-800/70 rounded-md text-amber-200 space-y-1">
                  <div className="font-semibold">Uncertain / Missing Fields Detected:</div>
                  {extracted.uncertain_fields.map((u, i) => (
                    <div key={i} className="font-mono">• {u}</div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(editableFields).map(([key, val]) => (
                  <div key={key}>
                    <label className="block text-slate-400 font-mono mb-1">{key}</label>
                    <input
                      value={val}
                      readOnly={isReadOnly}
                      onChange={(e) => setEditableFields({ ...editableFields, [key]: e.target.value })}
                      className="w-full bg-[#07090E] border border-slate-700 rounded-md px-3 py-1.5 font-mono text-slate-100 read-only:opacity-60"
                    />
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-400">
                  {isReadOnly
                    ? 'Saving disabled in Review-Only permission mode.'
                    : 'Explicit confirmation required. Saved records are marked MANUAL.'}
                </span>
                <button
                  type="button"
                  disabled={!extracted.validation_passed || isReadOnly}
                  onClick={handleConfirmSave}
                  className="px-4 py-2 text-xs font-medium bg-emerald-500 text-slate-950 rounded-md hover:bg-emerald-400 disabled:opacity-50 whitespace-nowrap"
                >
                  Confirm &amp; Save to Database
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
