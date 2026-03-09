import React, { useState } from 'react';
import type { OverlayMode } from '@shared/types';

interface WorkspaceScreenProps {
  onActivateOverlay: (mode: OverlayMode) => void;
}

interface Suggestion {
  id: string;
  title: string;
  description: string;
  type: 'accessibility' | 'layout' | 'performance';
}

const WorkspaceScreen: React.FC<WorkspaceScreenProps> = ({
  onActivateOverlay,
}) => {
  const [activeMode, setActiveMode] = useState<OverlayMode>('off');

  const suggestions: Suggestion[] = [
    {
      id: '1',
      title: 'Hero Contrast',
      description:
        'Suggested darkening the hero background for better accessibility.',
      type: 'accessibility',
    },
    {
      id: '2',
      title: 'Layout Shift',
      description:
        'Found a potential CLS issue on mobile viewport resize.',
      type: 'layout',
    },
  ];

  const handleModeChange = (mode: OverlayMode) => {
    setActiveMode(mode);
    onActivateOverlay(mode);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Echo Panel Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-echo-text">
            Echo Panel
          </h2>
          <p className="text-xs text-echo-text-muted mt-0.5">
            Live Session
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-echo-success/10 rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-echo-success animate-pulse" />
          <span className="text-[10px] font-medium text-echo-success">
            Connected
          </span>
        </div>
      </div>

      {/* Page Info */}
      <div className="px-3 py-2.5 bg-echo-code-bg rounded-lg border border-echo-border">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-echo-text-muted uppercase tracking-wider">
            Page
          </span>
          <code className="text-xs font-mono text-primary truncate">
            Index Page
          </code>
        </div>
        <p className="text-[11px] text-echo-text-muted mt-1">
          System ready. No user interactions detected.
        </p>
      </div>

      {/* Overlay Mode Selector */}
      <div>
        <h3 className="text-xs font-medium text-echo-text-muted uppercase tracking-wider mb-2">
          Selection Mode
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <ModeButton
            label="Off"
            active={activeMode === 'off'}
            onClick={() => handleModeChange('off')}
            icon="○"
          />
          <ModeButton
            label="Grid"
            active={activeMode === 'grid'}
            onClick={() => handleModeChange('grid')}
            icon="▦"
          />
          <ModeButton
            label="Div Box"
            active={activeMode === 'divbox'}
            onClick={() => handleModeChange('divbox')}
            icon="▣"
          />
        </div>
      </div>

      {/* Recent Suggestions */}
      <div>
        <h3 className="text-xs font-medium text-echo-text-muted uppercase tracking-wider mb-2">
          Recent Suggestions
        </h3>
        <div className="space-y-2">
          {suggestions.map((s) => (
            <SuggestionCard key={s.id} suggestion={s} />
          ))}
        </div>
      </div>

      {/* How to Start */}
      <div className="mt-2 p-3 bg-primary/5 rounded-lg border border-primary/10">
        <h4 className="text-xs font-semibold text-primary mb-1.5">
          How to start
        </h4>
        <ol className="text-[11px] text-echo-text-secondary space-y-1 list-decimal list-inside">
          <li>Select a mode above (Grid or Div Box)</li>
          <li>Click or drag to select an element on the page</li>
          <li>Describe your desired change or use gestures</li>
          <li>Review the generated prompt and send to your IDE</li>
        </ol>
      </div>
    </div>
  );
};

const ModeButton: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
  icon: string;
}> = ({ label, active, onClick, icon }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border text-xs font-medium transition-all ${
      active
        ? 'bg-primary/10 border-primary/30 text-primary'
        : 'bg-echo-surface border-echo-border text-echo-text-secondary hover:border-primary/20 hover:text-echo-text'
    }`}
  >
    <span className="text-base">{icon}</span>
    <span>{label}</span>
  </button>
);

const SuggestionCard: React.FC<{ suggestion: Suggestion }> = ({
  suggestion,
}) => {
  const typeColors = {
    accessibility: 'bg-echo-warning/10 text-echo-warning',
    layout: 'bg-echo-error/10 text-echo-error',
    performance: 'bg-primary/10 text-primary',
  };

  return (
    <div className="p-3 bg-echo-surface rounded-lg border border-echo-border hover:border-primary/20 transition-colors cursor-pointer">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-medium text-echo-text">
            {suggestion.title}
          </h4>
          <p className="text-[11px] text-echo-text-secondary mt-0.5 leading-relaxed">
            {suggestion.description}
          </p>
        </div>
        <span
          className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${typeColors[suggestion.type]}`}
        >
          {suggestion.type}
        </span>
      </div>
    </div>
  );
};

export default WorkspaceScreen;
