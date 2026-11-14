import { db, utcNowIso } from './db.ts';

interface ResearchDocRow {
  doc_id: string;
  title: string;
  source_org: string;
  publication_year: number;
  url: string;
  hazard_category: string;
  abstract: string;
  content_chunks_json: string;
  verified_reference: string;
}

export interface CitationHit {
  doc_id: string;
  title: string;
  source_org: string;
  url: string;
  hazard_category: string;
  verified_reference: string;
  excerpt: string;
  score: number;
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was', 'were',
  'how', 'what', 'why', 'does', 'into', 'about', 'have', 'has', 'can', 'will',
  'many', 'much', 'when', 'where', 'which', 'who', 'did', 'nasa', 'astronaut',
  'astronauts', 'space', 'spaceflight', 'mission', 'missions',
]);

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]{3,}/g) || []).filter((t) => !STOPWORDS.has(t));
}

export function retrieveNasaResearch(query: string, topK = 3): CitationHit[] {
  const qTokens = Array.from(new Set(tokenize(query)));
  if (qTokens.length === 0) return [];
  const docs = db.prepare('SELECT * FROM research_documents').all() as unknown as ResearchDocRow[];
  const scored: CitationHit[] = [];

  for (const doc of docs) {
    const chunks = JSON.parse(doc.content_chunks_json) as string[];
    for (const chunk of chunks) {
      const hay = `${doc.title} ${doc.hazard_category} ${doc.abstract} ${chunk}`;
      const cTokens = tokenize(hay);
      const cSet = new Set(cTokens);
      let overlap = 0;
      for (const qt of qTokens) {
        if (cSet.has(qt)) overlap += 1;
      }
      const minRequired = qTokens.length >= 4 ? 2 : 1;
      if (overlap >= minRequired) {
        const score = Number((overlap / Math.sqrt(cTokens.length + 1)).toFixed(4));
        scored.push({
          doc_id: doc.doc_id,
          title: doc.title,
          source_org: doc.source_org,
          url: doc.url,
          hazard_category: doc.hazard_category,
          verified_reference: doc.verified_reference,
          excerpt: chunk,
          score,
        });
      }
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

export async function checkLocalOllamaStatus() {
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1200);
    const resp = await fetch(`${baseUrl}/api/tags`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (resp.ok) {
      const body = (await resp.json()) as { models?: Array<{ name: string }> };
      return {
        connected: true,
        base_url: baseUrl,
        available_models: (body.models || []).map((m) => m.name),
        preferred_model: process.env.OLLAMA_CHAT_MODEL || 'qwen2.5:3b',
        embed_model: process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text',
      };
    }
  } catch {
    // Expected when Ollama daemon is not running locally or inside cloud preview
  }
  return {
    connected: false,
    base_url: baseUrl,
    available_models: [],
    preferred_model: process.env.OLLAMA_CHAT_MODEL || 'qwen2.5:3b',
    embed_model: process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text',
    how_to_start: "Run 'ollama serve' locally, pull 'ollama pull qwen2.5:3b' and 'ollama pull nomic-embed-text', and start the Python FastAPI backend.",
  };
}

export async function queryGroundedAssistant(
  question: string,
  astronautId: number | null,
  sessionId = 'default-local-session',
  modelName?: string
) {
  const citations = retrieveNasaResearch(question, 3);
  const ollama = await checkLocalOllamaStatus();
  const targetModel = modelName || ollama.preferred_model;

  const contextRecords: Array<Record<string, unknown>> = [];
  let personalSummary = 'No specific astronaut selected; summarizing latest habitat telemetry.';

  if (astronautId) {
    const astro = db.prepare('SELECT * FROM astronauts WHERE id = ?').get(astronautId) as Record<string, unknown> | undefined;
    if (astro) {
      const latest = db
        .prepare('SELECT * FROM health_records WHERE astronaut_id = ? ORDER BY recorded_at DESC LIMIT 5')
        .all(astronautId) as Array<Record<string, unknown>>;
      const alerts = db
        .prepare("SELECT * FROM anomaly_alerts WHERE astronaut_id = ? AND status = 'ACTIVE' ORDER BY detected_at DESC LIMIT 3")
        .all(astronautId) as Array<Record<string, unknown>>;
      contextRecords.push({
        type: 'astronaut_profile',
        call_sign: astro.call_sign,
        role: astro.role,
        data_source: astro.data_source,
        records_retrieved: latest.length,
        active_alerts: alerts.length,
      });

      const lines = [
        `Astronaut ${astro.call_sign} (${astro.full_name}, ${astro.role}, Data Source: ${astro.data_source}, Mission Day ${astro.mission_day}/${astro.mission_duration_days}):`,
      ];
      for (const r of latest) {
        lines.push(
          `  - ${String(r.recorded_at).slice(0, 10)} [${r.data_source}]: HR ${r.heart_rate_bpm} bpm, SpO2 ${r.spo2_pct}%, Sleep ${r.sleep_duration_hrs}h, Stress ${r.stress_score}/10, Mood ${r.mood_score}/10`
        );
      }
      if (alerts.length > 0) {
        for (const a of alerts) {
          lines.push(`  - ACTIVE ALERT (${a.severity_tier}): ${a.explanation}`);
        }
      } else {
        lines.push('  - No active personal-baseline anomaly alerts currently flagged.');
      }
      personalSummary = lines.join('\n');
    }
  } else {
    const env = db.prepare('SELECT * FROM environmental_records ORDER BY recorded_at DESC LIMIT 1').get() as
      | Record<string, unknown>
      | undefined;
    if (env) {
      contextRecords.push({ type: 'habitat_environment', data_source: env.data_source });
      personalSummary = `Latest Habitat Environment (${String(env.recorded_at).slice(0, 10)}, ${env.data_source}): Radiation ${env.radiation_msv_day} mSv/day, CO2 ${env.cabin_co2_ppm} ppm, O2 ${env.oxygen_pct}%, Temp ${env.temperature_c} °C, Humidity ${env.humidity_pct}%.`;
    }
  }

  const UNMONITORED_TERMS: Array<[RegExp, string]> = [
    [/\bblood\s*pressure\b|\bsystolic\b|\bdiastolic\b/i, 'blood pressure'],
    [/\becg\b|\bekg\b|\belectrocardiogram\b/i, 'ECG/EKG waveform'],
    [/\bglucose\b|\binsulin\b|\bblood\s*sugar\b/i, 'blood glucose'],
    [/\bbone\s*density\b|\bdxa\b/i, 'DXA bone mineral density'],
    [/\bmri\b|\bx-?ray\b|\bct\s*scan\b/i, 'medical imaging (MRI/X-ray/CT)'],
  ];
  const unmonitoredHits = UNMONITORED_TERMS.filter(([rx]) => rx.test(question)).map(([, label]) => label);
  const missingTelemetryNotice =
    unmonitoredHits.length > 0
      ? `Unavailable Telemetry Notice: ${unmonitoredHits.join(', ')} ${unmonitoredHits.length === 1 ? 'is' : 'are'} NOT collected in the local SQLite database. Available physiological metrics are Heart Rate, SpO2, Sleep Duration/Stages, Physical Activity, Stress, and Mood.`
      : '';

  const strongCitations = citations.filter((c) => (c.score ?? 0) >= 0.08);
  const uncertaintyNote =
    'Decision-support only: Never interprets alerts as medical diagnoses. Synthetic benchmark records are labeled SYNTHETIC.';
  let engineUsed = 'Local Grounded Retrieval (Ollama Offline)';
  let answerText = '';

  if (ollama.connected) {
    try {
      const citationsBlock =
        strongCitations.map((c, i) => `[${i + 1}] ${c.title} (${c.doc_id}): ${c.excerpt}`).join('\n') ||
        'No matching documents in local corpus.';
      const resp = await fetch(`${ollama.base_url}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: targetModel,
          stream: false,
          messages: [
            {
              role: 'system',
              content:
                'You are an offline NASA-grounded astronaut medical decision-support assistant. Never diagnose diseases, prescribe treatments, or invent citations. If reliable information or telemetry is unavailable, explicitly admit that you do not know. State data provenance (SYNTHETIC vs MANUAL vs REAL) and uncertainty clearly.',
            },
            {
              role: 'user',
              content: `${missingTelemetryNotice ? missingTelemetryNotice + '\n\n' : ''}PERSONAL & HABITAT CONTEXT:\n${personalSummary}\n\nRETRIEVED NASA DOCUMENTS:\n${citationsBlock}\n\nQUESTION: ${question}`,
            },
          ],
        }),
      });
      if (resp.ok) {
        const json = (await resp.json()) as { message?: { content?: string } };
        if (json.message?.content) {
          answerText = json.message.content.trim();
          engineUsed = `Ollama Local (${targetModel})`;
        }
      }
    } catch {
      // Fallback below
    }
  }

  if (!answerText) {
    if (strongCitations.length === 0 && !astronautId) {
      answerText =
        `${missingTelemetryNotice ? missingTelemetryNotice + '\n\n' : ''}` +
        `Insufficient reliable information found in the local NASA research corpus or selected telemetry to answer this question accurately. ` +
        `No citations or external claims were fabricated. Available corpus topics include the Five NASA Spaceflight Hazards (Space Radiation, Isolation & Confinement, Distance from Earth, Gravity Fields, Hostile Closed Environments), NASA OSDR Inspiration4 studies (OSD-569/570/571/575), and LSDA/NLSP data governance.`;
    } else {
      const researchSection =
        strongCitations.length > 0
          ? strongCitations.map((c) => `• ${c.title} [${c.doc_id}]: ${c.excerpt}`).join('\n\n')
          : 'No matching verified NASA research excerpts were found in the local corpus for this specific query; no citations were fabricated.';

      answerText =
        `${missingTelemetryNotice ? missingTelemetryNotice + '\n\n' : ''}` +
        `Local Ollama service is not connected (${ollama.base_url}), so no generative LLM synthesis was fabricated. ` +
        `Below is the deterministic context retrieved directly from local SQLite records and the verified NASA research corpus:\n\n` +
        `[Telemetry & Profile Context]\n${personalSummary}\n\n` +
        `[Grounded NASA Research Excerpts]\n${researchSection}`;
    }
  }

  const now = utcNowIso();
  const ins = db.prepare(`
    INSERT INTO assistant_conversations (
      session_id, astronaut_id, role, message_text, citations_json,
      context_records_json, inference_engine, uncertainty_note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  ins.run(sessionId, astronautId, 'user', question, '[]', '[]', engineUsed, '', now);
  ins.run(
    sessionId,
    astronautId,
    'assistant',
    answerText,
    JSON.stringify(strongCitations),
    JSON.stringify(contextRecords),
    engineUsed,
    uncertaintyNote,
    now
  );

  return {
    answer: answerText,
    citations: strongCitations,
    context_records: contextRecords,
    inference_engine: engineUsed,
    ollama_connected: ollama.connected,
    uncertainty_note: uncertaintyNote,
  };
}
