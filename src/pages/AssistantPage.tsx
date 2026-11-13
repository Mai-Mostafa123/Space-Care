import React, { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { api } from '../services/apiAdapter';
import type { AssistantMessage, Astronaut, SystemStatus } from '../types/domain';

interface AssistantPageProps {
  astronauts: Astronaut[];
  selectedAstronautId: number | null;
  systemStatus: SystemStatus | null;
}

const SUGGESTED_QUESTIONS = [
  'Summarize recent physiological records and active anomalies for the selected astronaut.',
  'How do elevated cabin CO2 levels interact with sleep and cognitive performance in closed habitats?',
  'Explain the five NASA human spaceflight hazards and which ones cannot be measured directly by vital signs.',
  'What do NASA OSDR Inspiration4 datasets (OSD-569 to OSD-575) provide and what are their limitations?',
];

export const AssistantPage: React.FC<AssistantPageProps> = ({
  astronauts,
  selectedAstronautId,
  systemStatus,
}) => {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getAssistantHistory('default-local-session')
      .then(setMessages)
      .catch(() => setMessages([]));
  }, []);

  const sendQuery = async (questionText: string) => {
    const q = questionText.trim();
    if (!q || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.queryAssistant(q, selectedAstronautId, 'default-local-session');
      setMessages((prev) => [
        ...prev,
        {
          role: 'user',
          message_text: q,
          citations: [],
          context_records: [],
          inference_engine: res.inference_engine,
        },
        {
          role: 'assistant',
          message_text: res.answer,
          citations: res.citations,
          context_records: res.context_records,
          inference_engine: res.inference_engine,
          uncertainty_note: res.uncertainty_note,
        },
      ]);
      setInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assistant request failed');
    } finally {
      setLoading(false);
    }
  };

  const activeCrew = astronauts.find((a) => a.id === selectedAstronautId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Context & Status Column */}
      <aside className="lg:col-span-4 space-y-5">
        <section className="bg-[#0D111A] border border-slate-800/90 rounded-lg p-5 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-slate-100">
              Local Ollama & RAG Status
            </h2>
            <span className={`font-mono ${systemStatus?.ollama.connected ? 'text-emerald-400' : 'text-amber-400'}`}>
              {systemStatus?.ollama.connected ? 'Ollama Connected' : 'Ollama Offline'}
            </span>
          </div>

          <div className="space-y-1.5 text-slate-400">
            <div>
              Endpoint: <span className="font-mono text-slate-200">{systemStatus?.ollama.base_url || 'http://localhost:11434'}</span>
            </div>
            <div>
              Target Model: <span className="font-mono text-slate-200">{systemStatus?.ollama.preferred_model || 'qwen2.5:3b'}</span>
            </div>
            <div>
              Embeddings: <span className="font-mono text-slate-200">{systemStatus?.ollama.embed_model || 'nomic-embed-text'}</span>
            </div>
            <div>
              Active Crew Context:{' '}
              <span className="font-mono text-cyan-300">
                {activeCrew ? `${activeCrew.call_sign} (${activeCrew.data_source})` : 'Habitat Overview'}
              </span>
            </div>
          </div>

          {!systemStatus?.ollama.connected && (
            <div className="p-3 bg-[#07090E] border border-amber-800/50 rounded-md text-slate-300 leading-relaxed space-y-1.5">
              <div className="font-medium text-amber-300">Local Ollama Service Not Detected</div>
              <p className="text-[11px] text-slate-400">
                This environment is running without a local Ollama daemon. Queries still execute real SQLite personal-record retrieval and grounded NASA corpus search without fabricating LLM synthesis. To enable full local generative synthesis on Windows 11 (8 GB RAM):
              </p>
              <code className="block font-mono text-[11px] text-cyan-300 bg-slate-900/80 p-2 rounded">
                ollama serve{'\n'}ollama pull qwen2.5:3b{'\n'}ollama pull nomic-embed-text
              </code>
            </div>
          )}
        </section>

        <section className="bg-[#0D111A] border border-slate-800/90 rounded-lg p-5 space-y-3">
          <h3 className="font-display text-sm font-semibold text-slate-100">Suggested Queries</h3>
          <div className="space-y-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => sendQuery(q)}
                className="w-full text-left p-2.5 text-xs text-slate-300 bg-[#07090E] hover:bg-slate-800/60 border border-slate-800 rounded-md transition-colors leading-relaxed"
              >
                {q}
              </button>
            ))}
          </div>
        </section>
      </aside>

      {/* Right Chat & Grounded Citations Viewport */}
      <section className="lg:col-span-8 bg-[#0D111A] border border-slate-800/90 rounded-lg flex flex-col min-h-[560px] max-h-[75vh]">
        <div className="px-5 py-3.5 border-b border-slate-800/90 flex items-center justify-between text-xs">
          <span className="font-display font-semibold text-slate-100">
            Grounded NASA Research & Telemetry Assistant
          </span>
          <span className="font-mono text-slate-500">Zero Cloud AI Inference</span>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {messages.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400 max-w-md mx-auto space-y-2">
              <p className="text-slate-200 font-medium">Offline Decision-Support Ready</p>
              <p className="text-xs leading-relaxed">
                Ask about astronaut personal baselines, detected anomalies, habitat CO2/radiation correlations, or NASA Human Research Program evidence. Every research claim cites its verified source document.
              </p>
            </div>
          ) : (
            messages.map((m, idx) => (
              <div
                key={idx}
                className={`space-y-2 ${m.role === 'user' ? 'ml-auto max-w-xl bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3.5' : 'max-w-3xl bg-[#07090E] border border-slate-800/90 rounded-lg p-4'}`}
              >
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>{m.role === 'user' ? 'Operator Query' : m.inference_engine}</span>
                  {m.created_at && <span>{m.created_at.slice(11, 19)} UTC</span>}
                </div>

                <div className="text-xs sm:text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {m.message_text}
                </div>

                {m.citations && m.citations.length > 0 && (
                  <div className="pt-3 mt-3 border-t border-slate-800/80 space-y-2">
                    <div className="text-[11px] font-mono text-cyan-400">
                      Grounded NASA Citations ({m.citations.length})
                    </div>
                    {m.citations.map((c) => (
                      <div key={c.doc_id} className="text-xs bg-[#0D111A] border border-slate-800 rounded p-2.5 space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium text-slate-200">{c.title}</span>
                          <span className="font-mono text-[11px] text-slate-400">{c.doc_id}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">{c.source_org}</div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">{c.excerpt}</p>
                      </div>
                    ))}
                  </div>
                )}

                {m.uncertainty_note && (
                  <div className="text-[11px] text-slate-500 pt-1">{m.uncertainty_note}</div>
                )}
              </div>
            ))
          )}
        </div>

        {error && (
          <div className="mx-5 mb-2 p-2.5 text-xs text-rose-300 bg-rose-950/40 border border-rose-800 rounded">
            {error}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendQuery(input);
          }}
          className="p-4 border-t border-slate-800/90 flex items-center gap-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about crew baselines, anomalies, or NASA spaceflight hazards..."
            className="flex-1 bg-[#07090E] border border-slate-700 rounded-md px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 text-xs font-medium bg-cyan-500 text-slate-950 rounded-md hover:bg-cyan-400 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{loading ? 'Querying...' : 'Ask Assistant'}</span>
          </button>
        </form>
      </section>
    </div>
  );
};
