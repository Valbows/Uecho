/**
 * U:Echo — Request Queue
 * Manages a FIFO queue of gesture processing requests with rate limiting.
 * Enforces MAX_AGENT_INVOCATIONS_PER_MINUTE from shared constants.
 */

import type { MetadataPayload, AgentResponse } from '@shared/types';
import { MAX_AGENT_INVOCATIONS_PER_MINUTE, API_ENDPOINTS, PROMPT_TURNAROUND_TARGET_MS } from '@shared/constants';

export type RequestStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface QueuedRequest {
  id: string;
  metadata: MetadataPayload;
  status: RequestStatus;
  response?: AgentResponse;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

export type QueueCallback = (request: QueuedRequest) => void;

export class RequestQueue {
  private queue: QueuedRequest[] = [];
  private processing = false;
  private invocationTimestamps: number[] = [];
  private backendUrl: string;
  private onUpdate: QueueCallback | null = null;
  private currentAbortController: AbortController | null = null;

  constructor(backendUrl: string) {
    this.backendUrl = backendUrl;
  }

  setUpdateCallback(cb: QueueCallback): void {
    this.onUpdate = cb;
  }

  enqueue(metadata: MetadataPayload): string {
    const request: QueuedRequest = {
      id: crypto.randomUUID(),
      metadata,
      status: 'queued',
      createdAt: Date.now(),
    };
    this.queue.push(request);
    this.processNext();
    return request.id;
  }

  getQueue(): ReadonlyArray<QueuedRequest> {
    return [...this.queue];
  }

  getRequest(id: string): QueuedRequest | undefined {
    return this.queue.find((r) => r.id === id);
  }

  getPending(): number {
    return this.queue.filter((r) => r.status === 'queued').length;
  }

  clear(): void {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
    this.queue = [];
    this.processing = false;
    this.invocationTimestamps = [];
  }

  // ─── Internal Processing ──────────────────────────────────────

  private async processNext(): Promise<void> {
    if (this.processing) return;

    const next = this.queue.find((r) => r.status === 'queued');
    if (!next) return;

    // Rate limit check
    if (!this.canInvoke()) {
      const waitMs = this.getWaitTime();
      setTimeout(() => this.processNext(), waitMs);
      return;
    }

    this.processing = true;
    next.status = 'processing';
    this.notify(next);

    const controller = new AbortController();
    this.currentAbortController = controller;
    const timeoutId = setTimeout(
      () => controller.abort('timeout'),
      PROMPT_TURNAROUND_TARGET_MS * 2
    );

    try {
      const response = await fetch(
        `${this.backendUrl}${API_ENDPOINTS.processGesture}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(next.metadata),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}: ${response.statusText}`);
      }

      const agentResponse: AgentResponse = await response.json();
      this.recordInvocation();

      next.status = 'completed';
      next.response = agentResponse;
      next.completedAt = Date.now();
    } catch (error) {
      clearTimeout(timeoutId);
      if (controller.signal.aborted && controller.signal.reason !== 'timeout') return;
      next.status = 'failed';
      next.error = controller.signal.reason === 'timeout'
        ? `Request timed out after ${PROMPT_TURNAROUND_TARGET_MS * 2}ms`
        : (error instanceof Error ? error.message : String(error));
      next.completedAt = Date.now();
    }

    this.currentAbortController = null;
    this.processing = false;
    this.notify(next);

    // Process next in queue
    this.processNext();
  }

  private canInvoke(): boolean {
    const now = Date.now();
    const windowStart = now - 60_000;
    this.invocationTimestamps = this.invocationTimestamps.filter((t) => t > windowStart);
    return this.invocationTimestamps.length < MAX_AGENT_INVOCATIONS_PER_MINUTE;
  }

  private getWaitTime(): number {
    if (this.invocationTimestamps.length === 0) return 0;
    const oldest = this.invocationTimestamps[0];
    return Math.max(0, oldest + 60_000 - Date.now() + 100);
  }

  private recordInvocation(): void {
    this.invocationTimestamps.push(Date.now());
  }

  private notify(request: QueuedRequest): void {
    if (this.onUpdate) {
      this.onUpdate({ ...request });
    }
  }
}
