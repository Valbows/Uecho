import React, { useState, useEffect } from 'react';
import type {
  ConnectivityStatus,
  OverlayMode,
  PromptSchema,
  VerificationResult,
  IDETarget,
} from '@shared/types';
import WelcomeScreen from './components/WelcomeScreen';
import WorkspaceScreen from './components/WorkspaceScreen';
import AgentScreen from './components/AgentScreen';
import VerifyScreen from './components/VerifyScreen';
import HistoryScreen from './components/HistoryScreen';

type Screen = 'welcome' | 'workspace' | 'agent' | 'verify' | 'history';

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('welcome');
  const [connectivity, setConnectivity] = useState<ConnectivityStatus>({
    extension: true,
    backend: false,
    ide_bridge: false,
  });
  const [currentPrompt, setCurrentPrompt] = useState<PromptSchema | null>(
    null
  );
  const [currentVerification, setCurrentVerification] =
    useState<VerificationResult | null>(null);

  useEffect(() => {
    const listener = (message: { type: string; payload: unknown }) => {
      if (message.type === 'SW_CONNECTIVITY_UPDATE') {
        setConnectivity(message.payload as ConnectivityStatus);
      }
      if (message.type === 'SW_AGENT_RESPONSE') {
        const resp = message.payload as {
          prompt?: PromptSchema;
          verification?: VerificationResult;
        };
        if (resp.prompt) setCurrentPrompt(resp.prompt);
        if (resp.verification) setCurrentVerification(resp.verification);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    chrome.runtime.sendMessage({ type: 'SP_CHECK_CONNECTIVITY' });
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const handleActivateOverlay = (mode: OverlayMode) => {
    if (mode === 'off') {
      chrome.runtime.sendMessage({ type: 'SP_DEACTIVATE_AGENT' });
    } else {
      chrome.runtime.sendMessage({
        type: 'SP_ACTIVATE_AGENT',
        payload: { mode },
      });
    }
  };

  const handleSubmitText = (text: string) => {
    chrome.runtime.sendMessage({
      type: 'SP_SUBMIT_TEXT',
      payload: { text },
    });
  };

  const handleEnhanceText = (text: string) => {
    chrome.runtime.sendMessage({
      type: 'SP_ENHANCE_TEXT',
      payload: { text },
    });
  };

  const handleConfirmPrompt = (prompt: PromptSchema, ideTarget: IDETarget) => {
    chrome.runtime.sendMessage({
      type: 'SP_CONFIRM_PROMPT',
      payload: { prompt, ide_target: ideTarget },
    });
  };

  const handleExportCsv = () => {
    chrome.runtime.sendMessage({ type: 'SP_EXPORT_CSV', payload: {} });
  };

  const handleNavigateToVerify = (prompt: PromptSchema) => {
    setCurrentPrompt(prompt);
    setCurrentScreen('verify');
  };

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
        <div className="flex items-center gap-1.5">
          <StatusDot active={connectivity.extension} label="Ext" />
          <StatusDot active={connectivity.backend} label="API" />
          <StatusDot active={connectivity.ide_bridge} label="IDE" />
        </div>
      </header>

      {/* Navigation */}
      <nav className="flex border-b border-echo-border bg-echo-surface">
        {(
          [
            ['welcome', 'Connect'],
            ['workspace', 'Workspace'],
            ['agent', 'Agent'],
            ['verify', 'Handoff'],
            ['history', 'History'],
          ] as const
        ).map(([key, label]) => (
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
        {currentScreen === 'workspace' && (
          <WorkspaceScreen onActivateOverlay={handleActivateOverlay} />
        )}
        {currentScreen === 'agent' && (
          <AgentScreen
            onSubmitText={handleSubmitText}
            onEnhanceText={handleEnhanceText}
            onNavigateToVerify={handleNavigateToVerify}
          />
        )}
        {currentScreen === 'verify' && (
          <VerifyScreen
            prompt={currentPrompt}
            verification={currentVerification}
            onConfirm={handleConfirmPrompt}
            onBack={() => setCurrentScreen('agent')}
          />
        )}
        {currentScreen === 'history' && (
          <HistoryScreen onExportCsv={handleExportCsv} />
        )}
      </main>
    </div>
  );
};

const StatusDot: React.FC<{ active: boolean; label: string }> = ({
  active,
  label,
}) => (
  <div
    className="flex items-center gap-1"
    title={`${label}: ${active ? 'Connected' : 'Disconnected'}`}
  >
    <div
      className={`w-2 h-2 rounded-full ${
        active ? 'bg-echo-success' : 'bg-echo-error'
      }`}
    />
    <span className="text-[10px] text-echo-text-muted">{label}</span>
  </div>
);

export default App;
