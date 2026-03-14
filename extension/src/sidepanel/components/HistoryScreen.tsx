import React, { useState, useEffect, useCallback } from 'react';
import { MCP_BRIDGE_URL } from '@shared/constants';

/** Shape returned by the MCP bridge GET /prompts endpoint */
interface BridgePrompt {
  prompt_id: string;
  ide_target: string;
  feature_name: string;
  selector: string;
  action_type: string;
  status: 'queued' | 'delivered' | 'failed';
  created_at: string;
  updated_at: string;
  error?: string;
}

interface HistoryScreenProps {
  onExportCsv: () => void;
}

const HistoryScreen: React.FC<HistoryScreenProps> = ({ onExportCsv }) => {
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<BridgePrompt[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Fetch real prompt history from the MCP bridge */
  const fetchHistory = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${MCP_BRIDGE_URL}/prompts?limit=50`, { signal });
      if (!res.ok) throw new Error(`Bridge returned ${res.status}`);
      const data = await res.json();
      setPrompts(data.prompts ?? []);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to reach MCP bridge');
      setPrompts([]);
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  // Load on mount; abort in-flight request on unmount
  useEffect(() => {
    const controller = new AbortController();
    fetchHistory(controller.signal);
    return () => controller.abort();
  }, [fetchHistory]);

  const stats = {
    total: prompts.length,
    delivered: prompts.filter((p) => p.status === 'delivered').length,
    queued: prompts.filter((p) => p.status === 'queued').length,
  };

  const selected = prompts.find((p) => p.prompt_id === selectedRequest);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="pb-3 border-b border-echo-border mb-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-echo-text">
              Activity Logs
            </h2>
            <p className="text-[11px] text-echo-text-secondary mt-0.5">
              Real-time prompt history from MCP bridge.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchHistory()}
              disabled={isLoading}
              title="Refresh history"
              className="w-7 h-7 flex items-center justify-center rounded-md border border-echo-border
                text-echo-text-muted hover:text-primary hover:border-primary/30 transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={isLoading ? 'animate-spin' : ''}>
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 21h5v-5" />
              </svg>
            </button>
            <button
              onClick={onExportCsv}
              className="px-3 py-1.5 text-[11px] font-medium text-primary bg-primary/10 rounded-md
                hover:bg-primary/15 transition-colors"
            >
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-3 px-3 py-2 bg-echo-error/10 border border-echo-error/20 rounded-lg">
          <p className="text-[11px] text-echo-error">{error}</p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatCard label="Total" value={String(stats.total)} />
        <StatCard label="Delivered" value={String(stats.delivered)} color="success" />
        <StatCard label="Queued" value={String(stats.queued)} />
      </div>

      {/* Prompt List */}
      <div className="flex-1 overflow-y-auto space-y-1.5">
        {isLoading && prompts.length === 0 && (
          <div className="text-center py-8 text-echo-text-muted text-xs">
            Loading…
          </div>
        )}
        {prompts.length === 0 && !isLoading && !error && (
          <div className="text-center py-8 text-echo-text-muted text-xs">
            No prompts yet. Push a design change from the Agent tab.
          </div>
        )}
        {prompts.map((p) => (
          <PromptRow
            key={p.prompt_id}
            prompt={p}
            isSelected={selectedRequest === p.prompt_id}
            onClick={() =>
              setSelectedRequest(
                selectedRequest === p.prompt_id ? null : p.prompt_id
              )
            }
          />
        ))}
      </div>

      {/* Prompt Detail Panel */}
      {selected && (
        <div className="border-t border-echo-border pt-3 mt-3">
          <h3 className="text-xs font-medium text-echo-text-muted uppercase tracking-wider mb-2">
            Prompt Details
          </h3>
          <div className="space-y-2">
            <DetailRow label="Feature">
              <span className="text-xs text-echo-text">
                {selected.feature_name}
              </span>
            </DetailRow>
            <DetailRow label="Selector">
              <code className="text-[11px] font-mono text-primary bg-echo-code-bg px-1.5 py-0.5 rounded">
                {selected.selector}
              </code>
            </DetailRow>
            <DetailRow label="Action">
              <span className="text-xs text-echo-text capitalize">
                {selected.action_type}
              </span>
            </DetailRow>
            <DetailRow label="IDE Target">
              <span className="text-xs text-echo-text capitalize">
                {selected.ide_target}
              </span>
            </DetailRow>
            <DetailRow label="Status">
              <StatusBadge status={selected.status} />
            </DetailRow>
            {selected.error && (
              <DetailRow label="Error">
                <span className="text-xs text-echo-error">{selected.error}</span>
              </DetailRow>
            )}

            {/* Timeline */}
            <div className="mt-3">
              <h4 className="text-[10px] font-medium text-echo-text-muted uppercase tracking-wider mb-2">
                Timeline
              </h4>
              <div className="space-y-2 pl-3 border-l-2 border-echo-border">
                <TimelineEntry
                  label="Queued"
                  time={new Date(selected.created_at).toLocaleString()}
                />
                {selected.status === 'delivered' && (
                  <TimelineEntry
                    label="Delivered to IDE"
                    time={new Date(selected.updated_at).toLocaleString()}
                  />
                )}
                {selected.status === 'failed' && (
                  <TimelineEntry
                    label="Failed"
                    time={new Date(selected.updated_at).toLocaleString()}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center pt-2 mt-2 border-t border-echo-border">
        <span className="text-[10px] text-echo-text-muted">
          {prompts.length > 0
            ? `Showing ${prompts.length} prompt${prompts.length !== 1 ? 's' : ''}`
            : 'No prompts'}
        </span>
      </div>
    </div>
  );
};

const StatCard: React.FC<{
  label: string;
  value: string;
  color?: 'success' | 'default';
}> = ({ label, value, color = 'default' }) => (
  <div className="flex flex-col items-center py-2.5 bg-echo-surface rounded-lg border border-echo-border">
    <span
      className={`text-lg font-bold ${
        color === 'success' ? 'text-echo-success' : 'text-echo-text'
      }`}
    >
      {value}
    </span>
    <span className="text-[9px] text-echo-text-muted mt-0.5">{label}</span>
  </div>
);

const PromptRow: React.FC<{
  prompt: BridgePrompt;
  isSelected: boolean;
  onClick: () => void;
}> = ({ prompt, isSelected, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all ${
      isSelected
        ? 'bg-primary/5 border-primary/20'
        : 'bg-echo-surface border-echo-border hover:border-primary/15'
    }`}
  >
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[11px] font-medium text-echo-text truncate">
        {prompt.feature_name}
      </span>
      <code className="text-[10px] font-mono text-primary bg-echo-code-bg px-1.5 py-0.5 rounded truncate max-w-[160px]">
        {prompt.selector}
      </code>
    </div>
    <StatusBadge status={prompt.status} />
  </button>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    queued: 'bg-echo-warning/10 text-echo-warning',
    delivered: 'bg-echo-success/10 text-echo-success',
    failed: 'bg-echo-error/10 text-echo-error',
  };

  return (
    <span
      className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${
        styles[status] || 'bg-echo-text-muted/10 text-echo-text-muted'
      }`}
    >
      {status}
    </span>
  );
};

const DetailRow: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => (
  <div className="flex items-center justify-between px-3 py-2 bg-echo-surface rounded-lg border border-echo-border">
    <span className="text-[11px] text-echo-text-muted">{label}</span>
    {children}
  </div>
);

const TimelineEntry: React.FC<{ label: string; time: string }> = ({
  label,
  time,
}) => (
  <div className="relative pl-3">
    <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-primary border-2 border-echo-bg" />
    <p className="text-[11px] font-medium text-echo-text">{label}</p>
    <p className="text-[10px] text-echo-text-muted">{time}</p>
  </div>
);

export default HistoryScreen;
