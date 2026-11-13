import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  Database,
  FileText,
  Gauge,
  Menu,
  Mic,
  ShieldAlert,
  Users,
  Wind,
  X,
} from 'lucide-react';
import type { Astronaut, PageId, SystemStatus } from '../types/domain';

interface LayoutShellProps {
  activePage: PageId;
  onSelectPage: (page: PageId) => void;
  astronauts: Astronaut[];
  selectedAstronautId: number | null;
  onSelectAstronaut: (id: number | null) => void;
  systemStatus: SystemStatus | null;
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{ id: PageId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Mission Overview', icon: Gauge },
  { id: 'profiles', label: 'Astronaut Profiles', icon: Users },
  { id: 'health', label: 'Health Telemetry', icon: Activity },
  { id: 'environment', label: 'Cabin Environment', icon: Wind },
  { id: 'anomalies', label: 'Anomaly Detection', icon: AlertTriangle },
  { id: 'assistant', label: 'Local AI Assistant', icon: Bot },
  { id: 'voice', label: 'Voice Entry', icon: Mic },
  { id: 'reports', label: 'Daily Reports', icon: FileText },
  { id: 'hazards', label: 'Five NASA Hazards', icon: ShieldAlert },
  { id: 'transparency', label: 'Data Transparency', icon: Database },
];

export const LayoutShell: React.FC<LayoutShellProps> = ({
  activePage,
  onSelectPage,
  astronauts,
  selectedAstronautId,
  onSelectAstronaut,
  systemStatus,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeNav = NAV_ITEMS.find((n) => n.id === activePage) || NAV_ITEMS[0];
  const selectedCrew = astronauts.find((a) => a.id === selectedAstronautId) || null;

  const renderNavList = () => (
    <nav aria-label="Primary Workspace Navigation" className="flex flex-col gap-1 px-3 py-4">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activePage === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              onSelectPage(item.id);
              setMobileMenuOpen(false);
            }}
            className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md text-left transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-cyan-400 ${
              isActive
                ? 'bg-cyan-500/12 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 border border-transparent'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col lg:flex-row">
      {/* Desktop Left Navigation Rail (256px) */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-[#0B0E17] border-r border-slate-800/90 z-30">
        <div className="px-5 py-5 border-b border-slate-800/90">
          <span className="font-display text-base font-semibold tracking-tight text-slate-100 whitespace-nowrap block">
            Aegis Orbital Health
          </span>
          <span className="text-xs text-slate-400 block mt-1">
            Decision-Support Prototype
          </span>
        </div>

        <div className="flex-1 overflow-y-auto">{renderNavList()}</div>

        <div className="p-4 border-t border-slate-800/90 text-xs text-slate-400 space-y-1.5">
          <div className="flex items-center justify-between">
            <span>SQLite Storage</span>
            <span className="font-mono text-emerald-400">
              {systemStatus?.database_connected ? 'Ready' : 'Checking'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Ollama Local LLM</span>
            <span className={`font-mono ${systemStatus?.ollama.connected ? 'text-emerald-400' : 'text-amber-400'}`}>
              {systemStatus?.ollama.connected ? 'Connected' : 'Offline'}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 pt-1">
            Non-diagnostic research system. Synthetic data explicitly tagged.
          </div>
        </div>
      </aside>

      {/* Mobile Header Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/70" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-64 max-w-[80vw] bg-[#0B0E17] border-r border-slate-800 flex flex-col h-full z-10">
            <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800">
              <span className="font-display text-sm font-semibold text-slate-100">Aegis Orbital Health</span>
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{renderNavList()}</div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar Contract: Context Breadcrumb + Crew Filter + Primary Voice Action */}
        <header className="sticky top-0 z-20 bg-[#07090E]/95 backdrop-blur-sm border-b border-slate-800/90 px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="Open navigation menu"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-400 hover:text-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline whitespace-nowrap">Mission Console</span>
              <span className="text-slate-600 hidden sm:inline" aria-hidden="true">/</span>
              <h1 className="font-display font-semibold text-slate-100 truncate">{activeNav.label}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <label htmlFor="crew-selector" className="sr-only">Active Crew Member</label>
            <select
              id="crew-selector"
              value={selectedAstronautId ?? ''}
              onChange={(e) => onSelectAstronaut(e.target.value ? Number(e.target.value) : null)}
              className="bg-[#0D111A] border border-slate-700/80 text-slate-200 text-xs font-mono rounded-md px-3 py-2 focus:outline-none focus:border-cyan-500 max-w-[190px] sm:max-w-[230px]"
            >
              <option value="">All Crew ({astronauts.length})</option>
              {astronauts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.call_sign} · {a.data_source}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => onSelectPage('voice')}
              className="px-3.5 py-2 text-xs font-medium bg-cyan-500 text-slate-950 rounded-md hover:bg-cyan-400 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Voice Log</span>
            </button>
          </div>
        </header>

        {/* Active Crew / Runtime Context Strip */}
        <div className="px-4 sm:px-6 py-2.5 bg-[#0B0E17] border-b border-slate-800/70 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              Active Scope:{' '}
              <strong className="text-slate-200 font-medium">
                {selectedCrew ? `${selectedCrew.call_sign} — ${selectedCrew.full_name}` : 'Full Crew Roster'}
              </strong>
            </span>
            {selectedCrew && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono">Day {selectedCrew.mission_day}/{selectedCrew.mission_duration_days}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-amber-300">Source: {selectedCrew.data_source}</span>
              </>
            )}
          </div>
          <div className="font-mono text-[11px] text-slate-500">
            Runtime: {systemStatus?.runtime_mode || 'Loading'} · Active Alerts: {systemStatus?.counts.active_anomalies ?? 0}
          </div>
        </div>

        <main className="flex-1 px-4 sm:px-6 py-6 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
