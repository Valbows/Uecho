import React, { useState, useEffect } from 'react';
import type { ConnectivityStatus } from '@shared/types';

type Screen = 'welcome' | 'workspace' | 'agent' | 'verify' | 'history';

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('welcome');
  const [connectivity, setConnectivity] = useState<ConnectivityStatus>({
    extension: true,
    backend: false,
    ide_bridge: false,
  });

  useEffect(() => {
    // Listen for connectivity updates from service worker
    const listener = (message: { type: string; payload: unknown }) => {
      if (message.type === 'SW_CONNECTIVITY_UPDATE') {
        setConnectivity(message.payload as ConnectivityStatus);
      }
    };
    chrome.runtime.onMessage.addListener(listener);

    // Initial connectivity check
    chrome.runtime.sendMessage({ type: 'SP_CHECK_CONNECTIVITY' });

    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-echo-bg">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-echo-border bg-echo-surface">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-white text-xs font-bold">U:</span>
          </div>
          <h1 className="text-base font-semibold">Echo</h1>
        </div>

        {/* Connectivity indicators */}
        <div className="flex items-center gap-1.5">
          <StatusDot active={connectivity.extension} label="Ext" />
          <StatusDot active={connectivity.backend} label="API" />
          <StatusDot active={connectivity.ide_bridge} label="IDE" />
        </div>
      </header>

      {/* Navigation */}
      <nav className="flex border-b border-echo-border bg-echo-surface">
        {([
          ['welcome', 'Connect'],
          ['workspace', 'Workspace'],
          ['agent', 'Agent'],
          ['verify', 'Handoff'],
          ['history', 'History'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setCurrentScreen(key)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              currentScreen === key
                ? 'text-primary border-b-2 border-primary'
                : 'text-echo-text-muted hover:text-echo-text-secondary'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-4">
        {currentScreen === 'welcome' && (
          <WelcomeScreen
            connectivity={connectivity}
            onComplete={() => setCurrentScreen('workspace')}
          />
        )}
        {currentScreen === 'workspace' && <WorkspaceScreen />}
        {currentScreen === 'agent' && <AgentScreen />}
        {currentScreen === 'verify' && <VerifyScreen />}
        {currentScreen === 'history' && <HistoryScreen />}
      </main>
    </div>
  );
};

// ─── Status Dot ─────────────────────────────────────────────────
const StatusDot: React.FC<{ active: boolean; label: string }> = ({
  active,
  label,
}) => (
  <div className="flex items-center gap-1" title={`${label}: ${active ? 'Connected' : 'Disconnected'}`}>
    <div
      className={`w-2 h-2 rounded-full ${
        active ? 'bg-echo-success' : 'bg-echo-error'
      }`}
    />
    <span className="text-[10px] text-echo-text-muted">{label}</span>
  </div>
);

// ─── Screen Placeholders ────────────────────────────────────────
const WelcomeScreen: React.FC<{
  connectivity: ConnectivityStatus;
  onComplete: () => void;
}> = ({ connectivity, onComplete }) => (
  <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
      <span className="text-primary text-2xl font-bold">U:</span>
    </div>
    <div>
      <h2 className="text-xl font-semibold mb-1">Welcome to U:Echo</h2>
      <p className="text-sm text-echo-text-secondary">
        Connect your services to get started
      </p>
    </div>

    <div className="w-full max-w-xs space-y-3">
      <ConnectivityRow
        label="Extension"
        connected={connectivity.extension}
      />
      <ConnectivityRow label="Backend API" connected={connectivity.backend} />
      <ConnectivityRow label="IDE Bridge" connected={connectivity.ide_bridge} />
    </div>

    <button
      onClick={onComplete}
      disabled={!connectivity.backend}
      className="px-6 py-2.5 bg-primary text-white text-sm font-medium rounded-lg
        disabled:opacity-40 disabled:cursor-not-allowed
        hover:bg-primary-600 transition-colors"
    >
      {connectivity.backend ? 'Enter Workspace' : 'Waiting for Backend...'}
    </button>
  </div>
);

const ConnectivityRow: React.FC<{
  label: string;
  connected: boolean;
}> = ({ label, connected }) => (
  <div className="flex items-center justify-between px-4 py-2.5 bg-echo-surface rounded-lg border border-echo-border">
    <span className="text-sm">{label}</span>
    <span
      className={`text-xs font-medium ${
        connected ? 'text-echo-success' : 'text-echo-error'
      }`}
    >
      {connected ? 'Connected' : 'Disconnected'}
    </span>
  </div>
);

const WorkspaceScreen: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-full text-center text-echo-text-secondary">
    <p className="text-sm">Navigate to a localhost page to begin.</p>
    <p className="text-xs mt-2 text-echo-text-muted">
      The overlay will activate when you select a mode.
    </p>
  </div>
);

const AgentScreen: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-full text-center text-echo-text-secondary">
    <p className="text-sm">AI Agent Panel</p>
    <p className="text-xs mt-2 text-echo-text-muted">
      Select an element on the page to activate the agent.
    </p>
  </div>
);

const VerifyScreen: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-full text-center text-echo-text-secondary">
    <p className="text-sm">Verify &amp; Handoff</p>
    <p className="text-xs mt-2 text-echo-text-muted">
      Review and confirm prompts before sending to your IDE.
    </p>
  </div>
);

const HistoryScreen: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-full text-center text-echo-text-secondary">
    <p className="text-sm">History &amp; Logs</p>
    <p className="text-xs mt-2 text-echo-text-muted">
      View past requests and export data.
    </p>
  </div>
);

export default App;
