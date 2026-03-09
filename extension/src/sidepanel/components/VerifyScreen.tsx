import React, { useState } from 'react';
import type { PromptSchema, VerificationResult, IDETarget } from '@shared/types';

interface VerifyScreenProps {
  prompt: PromptSchema | null;
  verification: VerificationResult | null;
  onConfirm: (prompt: PromptSchema, ideTarget: IDETarget) => void;
  onBack: () => void;
}

const VerifyScreen: React.FC<VerifyScreenProps> = ({
  prompt,
  verification,
  onConfirm,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<'prompt' | 'verification'>(
    'prompt'
  );
  const [selectedIDE, setSelectedIDE] = useState<IDETarget>('windsurf');

  if (!prompt) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="w-12 h-12 rounded-xl bg-echo-code-bg flex items-center justify-center mb-3">
          <span className="text-xl">📋</span>
        </div>
        <p className="text-sm text-echo-text-secondary">
          No prompt to review yet.
        </p>
        <p className="text-[11px] text-echo-text-muted mt-1">
          Select an element and describe a change to generate one.
        </p>
      </div>
    );
  }

  const confidenceScore = verification
    ? Math.round(verification.semantic_drift_score * 100)
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="pb-3 border-b border-echo-border mb-3">
        <div className="flex items-center gap-2 mb-1">
          <button
            onClick={onBack}
            className="text-xs text-echo-text-muted hover:text-echo-text transition-colors"
          >
            ← Back
          </button>
        </div>
        <h2 className="text-base font-semibold text-echo-text">
          Review &amp; Verify Prompt
        </h2>
        <p className="text-[11px] text-echo-text-secondary mt-0.5">
          Review the structured output below before pushing to your IDE.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-echo-border mb-3">
        <TabButton
          label="Prompt"
          active={activeTab === 'prompt'}
          onClick={() => setActiveTab('prompt')}
        />
        <TabButton
          label="Verification"
          active={activeTab === 'verification'}
          onClick={() => setActiveTab('verification')}
          badge={
            verification
              ? verification.schema_valid && verification.safety_passed
                ? 'pass'
                : 'fail'
              : undefined
          }
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'prompt' && (
          <div className="space-y-3">
            {/* Confidence Score */}
            {confidenceScore !== null && (
              <div className="flex items-center justify-between px-3 py-2 bg-echo-code-bg rounded-lg border border-echo-border">
                <span className="text-[11px] text-echo-text-secondary">
                  Confidence Score
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-echo-border rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        confidenceScore >= 80
                          ? 'bg-echo-success'
                          : confidenceScore >= 60
                            ? 'bg-echo-warning'
                            : 'bg-echo-error'
                      }`}
                      style={{ width: `${confidenceScore}%` }}
                    />
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      confidenceScore >= 80
                        ? 'text-echo-success'
                        : confidenceScore >= 60
                          ? 'text-echo-warning'
                          : 'text-echo-error'
                    }`}
                  >
                    {confidenceScore}%
                  </span>
                </div>
              </div>
            )}

            {/* JSON Prompt Display */}
            <div className="relative">
              <div className="px-3 py-2.5 bg-echo-code rounded-lg overflow-x-auto">
                <pre className="text-[11px] font-mono text-green-400 whitespace-pre-wrap leading-relaxed">
                  {JSON.stringify(
                    {
                      feature_name: prompt.feature_name,
                      selector: prompt.selector,
                      action_type: prompt.action_type,
                      visual_change_description:
                        prompt.visual_change_description,
                      current_dimensions: prompt.current_dimensions,
                      target_dimensions: prompt.target_dimensions,
                      prompt_text: prompt.prompt_text,
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
              <button
                onClick={() =>
                  navigator.clipboard.writeText(JSON.stringify(prompt, null, 2))
                }
                className="absolute top-2 right-2 px-2 py-1 text-[10px] font-medium text-echo-text-muted
                  bg-echo-code-bg/50 rounded hover:bg-echo-code-bg transition-colors"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        {activeTab === 'verification' && (
          <div className="space-y-3">
            {verification ? (
              <>
                <VerifyRow
                  label="Schema Valid"
                  passed={verification.schema_valid}
                />
                <VerifyRow
                  label="Safety Check"
                  passed={verification.safety_passed}
                />
                <VerifyRow
                  label="Consistency"
                  passed={verification.consistency_passed}
                />
                <VerifyRow
                  label="Semantic Drift"
                  passed={!verification.drift_warning}
                  detail={`Score: ${(verification.semantic_drift_score * 100).toFixed(1)}%`}
                />
                {verification.warnings.length > 0 && (
                  <div className="p-3 bg-echo-warning/5 rounded-lg border border-echo-warning/20">
                    <h4 className="text-[11px] font-medium text-echo-warning mb-1">
                      Warnings
                    </h4>
                    {verification.warnings.map((w, i) => (
                      <p
                        key={i}
                        className="text-[11px] text-echo-text-secondary"
                      >
                        {w}
                      </p>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-echo-text-muted text-center py-8">
                Verification results will appear after processing.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Destination IDE + Confirm */}
      <div className="border-t border-echo-border pt-3 mt-3 space-y-3">
        <div>
          <label className="text-[11px] font-medium text-echo-text-muted uppercase tracking-wider block mb-1.5">
            Destination IDE
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {(
              ['windsurf', 'cursor', 'vscode', 'antigravity'] as IDETarget[]
            ).map((ide) => (
              <button
                key={ide}
                onClick={() => setSelectedIDE(ide)}
                className={`py-1.5 text-[10px] font-medium rounded-md border transition-all ${
                  selectedIDE === ide
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-echo-surface border-echo-border text-echo-text-secondary hover:border-primary/20'
                }`}
              >
                {ide.charAt(0).toUpperCase() + ide.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => onConfirm(prompt, selectedIDE)}
          className="w-full py-2.5 bg-primary text-white text-sm font-semibold rounded-lg
            hover:bg-primary-600 active:bg-primary-700 transition-all
            shadow-md shadow-primary/20"
        >
          Push to {selectedIDE.charAt(0).toUpperCase() + selectedIDE.slice(1)}
        </button>
      </div>
    </div>
  );
};

const TabButton: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: 'pass' | 'fail';
}> = ({ label, active, onClick, badge }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
      active
        ? 'text-primary border-primary'
        : 'text-echo-text-muted border-transparent hover:text-echo-text-secondary'
    }`}
  >
    {label}
    {badge && (
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          badge === 'pass' ? 'bg-echo-success' : 'bg-echo-error'
        }`}
      />
    )}
  </button>
);

const VerifyRow: React.FC<{
  label: string;
  passed: boolean;
  detail?: string;
}> = ({ label, passed, detail }) => (
  <div className="flex items-center justify-between px-3 py-2.5 bg-echo-surface rounded-lg border border-echo-border">
    <span className="text-xs text-echo-text">{label}</span>
    <div className="flex items-center gap-2">
      {detail && (
        <span className="text-[10px] text-echo-text-muted">{detail}</span>
      )}
      <span
        className={`text-xs font-medium ${
          passed ? 'text-echo-success' : 'text-echo-error'
        }`}
      >
        {passed ? '✓ Pass' : '✗ Fail'}
      </span>
    </div>
  </div>
);

export default VerifyScreen;
