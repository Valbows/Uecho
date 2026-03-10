/**
 * U:Echo — Prompt Queue
 * In-memory queue with status tracking for prompt delivery to IDEs.
 * Supports queued → delivered | failed lifecycle.
 */

import type { FormattedPrompt } from './adapters';

export type PromptStatus = 'queued' | 'delivered' | 'failed';

export interface QueuedPrompt {
  prompt_id: string;
  ide_target: string;
  feature_name: string;
  selector: string;
  action_type: string;
  status: PromptStatus;
  formatted: FormattedPrompt;
  created_at: string;
  updated_at: string;
  error?: string;
}

const _queue: Map<string, QueuedPrompt> = new Map();
const MAX_QUEUE_SIZE = 500;
const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

function _evictTerminal(): void {
  // Remove oldest terminal (delivered/failed) entries first, then oldest queued
  const terminal: [string, QueuedPrompt][] = [];
  const queued: [string, QueuedPrompt][] = [];
  for (const [id, entry] of _queue) {
    if (entry.status !== 'queued') {
      terminal.push([id, entry]);
    } else {
      queued.push([id, entry]);
    }
  }
  terminal.sort((a, b) => a[1].updated_at.localeCompare(b[1].updated_at));
  let toRemove = _queue.size - MAX_QUEUE_SIZE + 1;
  for (const [id] of terminal) {
    if (toRemove <= 0) break;
    _queue.delete(id);
    toRemove--;
  }
  // If still over limit, evict oldest queued entries
  if (toRemove > 0) {
    queued.sort((a, b) => a[1].updated_at.localeCompare(b[1].updated_at));
    for (const [id] of queued) {
      if (toRemove <= 0) break;
      _queue.delete(id);
      toRemove--;
    }
  }
}

export function purgeTerminal(olderThanMs: number = DEFAULT_TTL_MS): number {
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  let removed = 0;
  for (const [id, entry] of _queue) {
    if (entry.status !== 'queued' && entry.updated_at < cutoff) {
      _queue.delete(id);
      removed++;
    }
  }
  return removed;
}

export function enqueue(
  prompt_id: string,
  formatted: FormattedPrompt,
  meta: { feature_name: string; selector: string; action_type: string }
): QueuedPrompt {
  if (_queue.has(prompt_id)) {
    throw new Error(`Duplicate prompt_id: ${prompt_id}`);
  }
  if (_queue.size >= MAX_QUEUE_SIZE) {
    _evictTerminal();
  }
  const now = new Date().toISOString();
  const entry: QueuedPrompt = {
    prompt_id,
    ide_target: formatted.ide_target,
    feature_name: meta.feature_name,
    selector: meta.selector,
    action_type: meta.action_type,
    status: 'queued',
    formatted,
    created_at: now,
    updated_at: now,
  };
  _queue.set(prompt_id, entry);
  return entry;
}

export function markDelivered(prompt_id: string): QueuedPrompt | undefined {
  const entry = _queue.get(prompt_id);
  if (!entry) return undefined;
  entry.status = 'delivered';
  entry.updated_at = new Date().toISOString();
  return entry;
}

export function markFailed(prompt_id: string, error: string): QueuedPrompt | undefined {
  const entry = _queue.get(prompt_id);
  if (!entry) return undefined;
  entry.status = 'failed';
  entry.error = error;
  entry.updated_at = new Date().toISOString();
  return entry;
}

export function getPrompt(prompt_id: string): QueuedPrompt | undefined {
  return _queue.get(prompt_id);
}

export function listPrompts(options?: {
  status?: PromptStatus;
  ide_target?: string;
  limit?: number;
}): QueuedPrompt[] {
  let results = Array.from(_queue.values());

  if (options?.status) {
    results = results.filter((p) => p.status === options.status);
  }
  if (options?.ide_target) {
    results = results.filter((p) => p.ide_target === options.ide_target);
  }

  // Most recent first
  results.sort((a, b) => b.created_at.localeCompare(a.created_at));

  if (options?.limit) {
    results = results.slice(0, options.limit);
  }

  return results;
}

export function queueSize(): number {
  return _queue.size;
}

export function clearQueue(): void {
  _queue.clear();
}
