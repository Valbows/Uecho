import React from 'react';
import type { ConnectivityStatus } from '@shared/types';

interface WelcomeScreenProps {
  connectivity: ConnectivityStatus;
  onComplete: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  connectivity,
  onComplete,
}) => {
  const allConnected =
    connectivity.extension && connectivity.backend && connectivity.ide_bridge;
  const canProceed = connectivity.backend;

  return (
    <div className="flex flex-col items-center h-full px-4 pt-8 pb-6">
      {/* Logo & Tagline */}
      <div className="flex flex-col items-center gap-3 mb-8">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-700 flex items-center justify-center shadow-lg shadow-primary/20">
          <span className="text-white text-2xl font-bold tracking-tight">
            U:
          </span>
        </div>
        <div className="text-center">
          <h1 className="text-lg font-semibold text-echo-text">U:Echo</h1>
          <p className="text-sm text-echo-text-secondary mt-1 max-w-[240px] leading-relaxed">
            Turn UI feedback into implementation-ready prompts
          </p>
        </div>
      </div>

      {/* System Connectivity */}
      <div className="w-full max-w-xs mb-6">
        <h3 className="text-xs font-medium text-echo-text-muted uppercase tracking-wider mb-3">
          System Connectivity
        </h3>
        <div className="space-y-2">
          <ConnectivityRow
            label="Chrome Extension"
            status={connectivity.extension ? 'connected' : 'disconnected'}
            icon="🧩"
          />
          <ConnectivityRow
            label="Backend API"
            status={connectivity.backend ? 'connected' : 'checking'}
            icon="⚡"
          />
          <ConnectivityRow
            label="IDE Bridge"
            status={
              connectivity.ide_bridge
                ? 'connected'
                : connectivity.backend
                  ? 'checking'
                  : 'disconnected'
            }
            icon="🔗"
          />
        </div>
      </div>

      {/* Status Summary */}
      <div
        className={`w-full max-w-xs px-4 py-3 rounded-lg border text-center text-xs mb-6 ${
          allConnected
            ? 'bg-echo-success/5 border-echo-success/20 text-echo-success'
            : canProceed
              ? 'bg-echo-warning/5 border-echo-warning/20 text-echo-warning'
              : 'bg-echo-error/5 border-echo-error/20 text-echo-text-secondary'
        }`}
      >
        {allConnected
          ? 'All systems connected. Ready to go!'
          : canProceed
            ? 'Backend connected. IDE bridge optional.'
            : 'Waiting for backend connection...'}
      </div>

      {/* CTA Button */}
      <button
        onClick={onComplete}
        disabled={!canProceed}
        className="w-full max-w-xs py-3 bg-primary text-white text-sm font-semibold rounded-lg
          disabled:opacity-40 disabled:cursor-not-allowed
          hover:bg-primary-600 active:bg-primary-700 transition-all
          shadow-md shadow-primary/20 disabled:shadow-none"
      >
        {canProceed ? 'Enter Workspace' : 'Connecting...'}
      </button>

      {/* Footer Links */}
      <div className="flex items-center gap-4 mt-auto pt-6">
        <FooterLink label="Documentation" />
        <FooterLink label="Release Notes" />
        <FooterLink label="Support" />
      </div>

      {/* Tagline */}
      <p className="text-[10px] text-echo-text-muted mt-3">
        Built for product teams, designers, and engineers.
      </p>
    </div>
  );
};

const ConnectivityRow: React.FC<{
  label: string;
  status: 'connected' | 'checking' | 'disconnected';
  icon: string;
}> = ({ label, status, icon }) => (
  <div className="flex items-center justify-between px-4 py-3 bg-echo-surface rounded-lg border border-echo-border">
    <div className="flex items-center gap-2.5">
      <span className="text-sm">{icon}</span>
      <span className="text-sm text-echo-text">{label}</span>
    </div>
    <div className="flex items-center gap-1.5">
      <div
        className={`w-2 h-2 rounded-full ${
          status === 'connected'
            ? 'bg-echo-success'
            : status === 'checking'
              ? 'bg-echo-warning animate-pulse'
              : 'bg-echo-error'
        }`}
      />
      <span
        className={`text-xs font-medium ${
          status === 'connected'
            ? 'text-echo-success'
            : status === 'checking'
              ? 'text-echo-warning'
              : 'text-echo-error'
        }`}
      >
        {status === 'connected'
          ? 'Connected'
          : status === 'checking'
            ? 'Checking...'
            : 'Offline'}
      </span>
    </div>
  </div>
);

const FooterLink: React.FC<{ label: string }> = ({ label }) => (
  <button className="text-[11px] text-echo-text-muted hover:text-primary transition-colors">
    {label}
  </button>
);

export default WelcomeScreen;
