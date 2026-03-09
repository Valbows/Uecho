import React, { useState } from 'react';
import type { RequestRecord } from '@shared/types';

interface HistoryScreenProps {
  onExportCsv: () => void;
}

const HistoryScreen: React.FC<HistoryScreenProps> = ({ onExportCsv }) => {
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);

  // Placeholder data — will be replaced with Firestore data in Phase 5
  const stats = {
    requestsToday: 12,
    verified: 10,
    avgTurnaround: '2m',
  };

  const requests: RequestRecord[] = [
    {
      request_id: 'req-1',
      session_id: 'sess-1',
      action_type: 'resize',
      selector: '#submit-order-btn',
      interpreted_intent: 'Purchase Conversion',
      status: 'verified',
      created_at: Date.now() - 3600000,
      updated_at: Date.now() - 3500000,
    },
    {
      request_id: 'req-2',
      session_id: 'sess-1',
      action_type: 'color',
      selector: '.nav-item--active',
      interpreted_intent: 'Navigation Highlight',
      status: 'sent',
      created_at: Date.now() - 7200000,
      updated_at: Date.now() - 7100000,
    },
    {
      request_id: 'req-3',
      session_id: 'sess-1',
      action_type: 'text',
      selector: 'input[name="search"]',
      interpreted_intent: 'Search Placeholder',
      status: 'processing',
      created_at: Date.now() - 10800000,
      updated_at: Date.now() - 10800000,
    },
    {
      request_id: 'req-4',
      session_id: 'sess-1',
      action_type: 'move',
      selector: '.price-toggle-btn',
      interpreted_intent: 'Pricing Toggle Reposition',
      status: 'pending',
      created_at: Date.now() - 14400000,
      updated_at: Date.now() - 14400000,
    },
  ];

  const selected = requests.find((r) => r.request_id === selectedRequest);

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
              Audit-ready history of all selector requests.
            </p>
          </div>
          <button
            onClick={onExportCsv}
            className="px-3 py-1.5 text-[11px] font-medium text-primary bg-primary/10 rounded-md
              hover:bg-primary/15 transition-colors"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatCard label="Requests Today" value={String(stats.requestsToday)} />
        <StatCard label="Verified" value={String(stats.verified)} color="success" />
        <StatCard label="Avg Turnaround" value={stats.avgTurnaround} />
      </div>

      {/* Request List */}
      <div className="flex-1 overflow-y-auto space-y-1.5">
        {requests.map((req) => (
          <RequestRow
            key={req.request_id}
            request={req}
            isSelected={selectedRequest === req.request_id}
            onClick={() =>
              setSelectedRequest(
                selectedRequest === req.request_id ? null : req.request_id
              )
            }
          />
        ))}
      </div>

      {/* Request Detail Panel */}
      {selected && (
        <div className="border-t border-echo-border pt-3 mt-3">
          <h3 className="text-xs font-medium text-echo-text-muted uppercase tracking-wider mb-2">
            Request Details
          </h3>
          <div className="space-y-2">
            <DetailRow label="Selector">
              <code className="text-[11px] font-mono text-primary bg-echo-code-bg px-1.5 py-0.5 rounded">
                {selected.selector}
              </code>
            </DetailRow>
            <DetailRow label="Intent">
              <span className="text-xs text-echo-text">
                {selected.interpreted_intent}
              </span>
            </DetailRow>
            <DetailRow label="Action">
              <span className="text-xs text-echo-text capitalize">
                {selected.action_type}
              </span>
            </DetailRow>
            <DetailRow label="Status">
              <StatusBadge status={selected.status} />
            </DetailRow>

            {/* Timeline */}
            <div className="mt-3">
              <h4 className="text-[10px] font-medium text-echo-text-muted uppercase tracking-wider mb-2">
                Timeline
              </h4>
              <div className="space-y-2 pl-3 border-l-2 border-echo-border">
                <TimelineEntry
                  label="Request Received"
                  time={new Date(selected.created_at).toLocaleString()}
                />
                {selected.status !== 'pending' && (
                  <TimelineEntry
                    label="Processing Started"
                    time={new Date(
                      selected.created_at + 13000
                    ).toLocaleString()}
                  />
                )}
                {(selected.status === 'verified' ||
                  selected.status === 'sent') && (
                  <TimelineEntry
                    label="Verified & Logged"
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
          Showing 1-{requests.length} of {requests.length} requests
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

const RequestRow: React.FC<{
  request: RequestRecord;
  isSelected: boolean;
  onClick: () => void;
}> = ({ request, isSelected, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all ${
      isSelected
        ? 'bg-primary/5 border-primary/20'
        : 'bg-echo-surface border-echo-border hover:border-primary/15'
    }`}
  >
    <div className="flex items-center gap-2.5 min-w-0">
      <code className="text-[10px] font-mono text-primary bg-echo-code-bg px-1.5 py-0.5 rounded truncate max-w-[160px]">
        {request.selector}
      </code>
    </div>
    <StatusBadge status={request.status} />
  </button>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    pending: 'bg-echo-text-muted/10 text-echo-text-muted',
    processing: 'bg-echo-warning/10 text-echo-warning',
    verified: 'bg-echo-success/10 text-echo-success',
    sent: 'bg-primary/10 text-primary',
    failed: 'bg-echo-error/10 text-echo-error',
  };

  return (
    <span
      className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${
        styles[status] || styles.pending
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
