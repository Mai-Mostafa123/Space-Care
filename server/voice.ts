export function extractStructuredFromTranscript(
  transcript: string,
  targetMode: 'health_log' | 'profile_update' = 'health_log'
) {
  const text = transcript.trim();
  const lower = text.toLowerCase();
  const extracted: Record<string, unknown> = {};
  const uncertainFields: string[] = [];
  const transcriptionErrors: string[] = [];

  if (text.length < 4) {
    transcriptionErrors.push('Transcript is too short to extract reliable structured values.');
  }

  if (targetMode === 'health_log') {
    const hrMatch = lower.match(/(?:heart\s*rate|hr|pulse)\s*(?:is|at|was|of|:)?\s*(\d{2,3}(?:\.\d+)?)/);
    const spo2Match = lower.match(/(?:spo2|oxygen|o2\s*sat(?:uration)?)\s*(?:is|at|was|of|:)?\s*(\d{2,3}(?:\.\d+)?)/);
    const sleepMatch = lower.match(/(?:slept|sleep(?:\s*duration)?)\s*(?:for|was|is|of|:)?\s*(\d{1,2}(?:\.\d+)?)\s*(?:hours?|hrs?|h)?/);
    const stressMatch = lower.match(/(?:stress)\s*(?:level|score|is|at|was|of|:)?\s*(\d{1,2}(?:\.\d+)?)/);
    const moodMatch = lower.match(/(?:mood)\s*(?:level|score|is|at|was|of|:)?\s*(\d{1,2}(?:\.\d+)?)/);
    const actMatch = lower.match(/(?:exercise|exercised|activity|workout)\s*(?:for|was|of|:)?\s*(\d{1,3})\s*(?:minutes?|mins?|m)?/);

    if (hrMatch) {
      const hr = Number(hrMatch[1]);
      extracted.heart_rate_bpm = hr;
      if (hr < 30 || hr > 220) {
        transcriptionErrors.push(`heart_rate_bpm (${hr}) is outside valid bounds [30, 220].`);
      } else if (hr < 40 || hr > 180) {
        uncertainFields.push('heart_rate_bpm (unusual range — verify before saving)');
      }
    } else {
      uncertainFields.push('heart_rate_bpm (not detected in speech)');
    }

    if (spo2Match) {
      const spo2 = Number(spo2Match[1]);
      extracted.spo2_pct = spo2;
      if (spo2 < 70 || spo2 > 100) {
        transcriptionErrors.push(`spo2_pct (${spo2}) is outside valid bounds [70, 100].`);
      }
    } else {
      uncertainFields.push('spo2_pct (not detected in speech)');
    }

    if (sleepMatch) {
      const sleep = Number(sleepMatch[1]);
      extracted.sleep_duration_hrs = sleep;
      if (sleep < 0 || sleep > 24) {
        transcriptionErrors.push(`sleep_duration_hrs (${sleep}) is outside valid bounds [0, 24].`);
      }
    }
    if (stressMatch) {
      extracted.stress_score = Math.min(10, Math.max(1, Number(stressMatch[1])));
    }
    if (moodMatch) {
      extracted.mood_score = Math.min(10, Math.max(1, Number(moodMatch[1])));
    }
    if (actMatch) {
      extracted.activity_minutes = Math.min(1440, Math.max(0, Number(actMatch[1])));
    }

    extracted.mood_notes = text;
    extracted.data_source = 'MANUAL';

    return {
      transcript: text,
      target_mode: targetMode,
      extracted_fields: extracted,
      uncertain_fields: uncertainFields,
      transcription_errors: transcriptionErrors,
      requires_confirmation: true,
      validation_passed: transcriptionErrors.length === 0,
    };
  }

  const roleMatch = text.match(/(?:role|position)\s*(?:is|as|to|:)?\s*([a-zA-Z\s]{3,40}?)(?:\.|,|mission|$)/i);
  const missionMatch = text.match(/(?:mission)\s*(?:is|name|:)?\s*([A-Z0-9-]{3,24})/);
  const dayMatch = lower.match(/mission\s*day\s*(\d{1,4})/);

  if (roleMatch) extracted.role = roleMatch[1].trim();
  else uncertainFields.push('role');
  if (missionMatch) extracted.mission_name = missionMatch[1].trim();
  if (dayMatch) extracted.mission_day = Number(dayMatch[1]);
  extracted.notes = text;

  return {
    transcript: text,
    target_mode: targetMode,
    extracted_fields: extracted,
    uncertain_fields: uncertainFields,
    transcription_errors: transcriptionErrors,
    requires_confirmation: true,
    validation_passed: transcriptionErrors.length === 0,
  };
}
