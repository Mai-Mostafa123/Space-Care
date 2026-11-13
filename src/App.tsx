/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { LayoutShell } from './components/LayoutShell';
import { AnomaliesPage } from './pages/AnomaliesPage';
import { AssistantPage } from './pages/AssistantPage';
import { EnvironmentPage } from './pages/EnvironmentPage';
import { HazardsPage } from './pages/HazardsPage';
import { HealthPage } from './pages/HealthPage';
import { OverviewPage } from './pages/OverviewPage';
import { ProfilesPage } from './pages/ProfilesPage';
import { ReportsPage } from './pages/ReportsPage';
import { TransparencyPage } from './pages/TransparencyPage';
import { VoicePage } from './pages/VoicePage';
import { api } from './services/apiAdapter';
import type {
  AnomalyAlert,
  Astronaut,
  EnvironmentalRecord,
  HealthRecord,
  PageId,
  SystemStatus,
} from './types/domain';

export default function App() {
  const [activePage, setActivePage] = useState<PageId>('overview');
  const [selectedAstronautId, setSelectedAstronautId] = useState<number | null>(null);
  const [astronauts, setAstronauts] = useState<Astronaut[]>([]);
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [envRecords, setEnvRecords] = useState<EnvironmentalRecord[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyAlert[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const refreshAll = useCallback(async () => {
    try {
      const [statusData, crewData, healthData, envData, anomalyData] = await Promise.all([
        api.getSystemStatus(),
        api.listAstronauts(),
        api.listHealth(),
        api.listEnvironment(),
        api.listAnomalies(),
      ]);
      setSystemStatus(statusData);
      setAstronauts(crewData);
      setHealthRecords(healthData);
      setEnvRecords(envData);
      setAnomalies(anomalyData);
      setLoadError('');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to connect to local API');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  return (
    <LayoutShell
      activePage={activePage}
      onSelectPage={setActivePage}
      astronauts={astronauts}
      selectedAstronautId={selectedAstronautId}
      onSelectAstronaut={setSelectedAstronautId}
      systemStatus={systemStatus}
    >
      {loading ? (
        <div className="bg-[#0D111A] border border-slate-800 rounded-lg p-12 text-center text-sm text-slate-400">
          Initializing local telemetry database and baseline models...
        </div>
      ) : loadError ? (
        <div className="bg-rose-950/30 border border-rose-800 rounded-lg p-6 text-sm text-rose-200 space-y-2">
          <div className="font-semibold">Backend Connection Error</div>
          <p className="text-xs font-mono">{loadError}</p>
          <button
            type="button"
            onClick={refreshAll}
            className="px-3.5 py-2 text-xs bg-rose-700 hover:bg-rose-600 text-white rounded-md"
          >
            Retry Connection
          </button>
        </div>
      ) : (
        <>
          {activePage === 'overview' && (
            <OverviewPage
              astronauts={astronauts}
              healthRecords={healthRecords}
              envRecords={envRecords}
              anomalies={anomalies}
              systemStatus={systemStatus}
              selectedAstronautId={selectedAstronautId}
              onNavigate={setActivePage}
            />
          )}
          {activePage === 'profiles' && (
            <ProfilesPage
              astronauts={astronauts}
              selectedAstronautId={selectedAstronautId}
              onSelectAstronaut={setSelectedAstronautId}
              onRefresh={refreshAll}
              onNavigate={setActivePage}
            />
          )}
          {activePage === 'health' && (
            <HealthPage
              astronauts={astronauts}
              healthRecords={healthRecords}
              selectedAstronautId={selectedAstronautId}
              onRefresh={refreshAll}
            />
          )}
          {activePage === 'environment' && (
            <EnvironmentPage envRecords={envRecords} onRefresh={refreshAll} />
          )}
          {activePage === 'anomalies' && (
            <AnomaliesPage
              anomalies={anomalies}
              selectedAstronautId={selectedAstronautId}
              onRefresh={refreshAll}
            />
          )}
          {activePage === 'assistant' && (
            <AssistantPage
              astronauts={astronauts}
              selectedAstronautId={selectedAstronautId}
              systemStatus={systemStatus}
            />
          )}
          {activePage === 'voice' && (
            <VoicePage
              astronauts={astronauts}
              selectedAstronautId={selectedAstronautId}
              onRefresh={refreshAll}
            />
          )}
          {activePage === 'reports' && (
            <ReportsPage selectedAstronautId={selectedAstronautId} />
          )}
          {activePage === 'hazards' && <HazardsPage />}
          {activePage === 'transparency' && <TransparencyPage />}
        </>
      )}
    </LayoutShell>
  );
}
