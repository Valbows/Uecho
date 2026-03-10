/**
 * U:Echo — Unit Tests: Request Queue
 */

import { RequestQueue } from '../../src/background/request-queue';
import type { MetadataPayload, GestureEvent } from '../../src/shared/types';

const mockGesture: GestureEvent = {
  type: 'resize',
  selector: '.btn',
  before_bbox: { x: 0, y: 0, width: 100, height: 40 },
  after_bbox: { x: 0, y: 0, width: 120, height: 40 },
  delta: { resize_right: 20 },
  timestamp: Date.now(),
};

function createMetadata(overrides?: Partial<MetadataPayload>): MetadataPayload {
  return {
    gesture: mockGesture,
    screenshot_url: '',
    tab_id: 1,
    page_url: 'http://localhost:3000',
    scroll_x: 0,
    scroll_y: 0,
    viewport_width: 1280,
    viewport_height: 720,
    extension_session_id: 'test-session',
    ...overrides,
  };
}

// Mock fetch globally — save original so afterEach can restore it
const originalFetch = global.fetch;

beforeEach(() => {
  (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        interpreted_intent: 'Test intent',
        status: 'success',
      }),
  });
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('RequestQueue: Basic Operations', () => {
  it('should enqueue a request and return an id', () => {
    const queue = new RequestQueue('http://localhost:8080');
    const id = queue.enqueue(createMetadata());
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('should track pending requests', () => {
    const queue = new RequestQueue('http://localhost:8080');
    // Note: processNext runs async, so pending might be 0 by the time we check
    // depending on microtask timing. We test the getQueue API instead.
    queue.enqueue(createMetadata());
    expect(queue.getQueue().length).toBe(1);
  });

  it('should find request by id', () => {
    const queue = new RequestQueue('http://localhost:8080');
    const id = queue.enqueue(createMetadata());
    const request = queue.getRequest(id);
    expect(request).toBeDefined();
    expect(request!.id).toBe(id);
  });

  it('should return undefined for unknown id', () => {
    const queue = new RequestQueue('http://localhost:8080');
    expect(queue.getRequest('nonexistent')).toBeUndefined();
  });

  it('should clear all requests', () => {
    const queue = new RequestQueue('http://localhost:8080');
    queue.enqueue(createMetadata());
    queue.enqueue(createMetadata());
    queue.clear();
    expect(queue.getQueue().length).toBe(0);
  });
});

describe('RequestQueue: Processing', () => {
  it('should call fetch with backend URL and metadata', async () => {
    const queue = new RequestQueue('http://localhost:8080');
    queue.enqueue(createMetadata());

    // Wait for async processing
    await new Promise((r) => setTimeout(r, 50));

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/process-gesture'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('should notify callback on completion', async () => {
    const queue = new RequestQueue('http://localhost:8080');
    const updates: string[] = [];
    queue.setUpdateCallback((req) => updates.push(req.status));

    queue.enqueue(createMetadata());
    await new Promise((r) => setTimeout(r, 50));

    expect(updates).toContain('processing');
    expect(updates).toContain('completed');
  });

  it('should mark request as failed on network error', async () => {
    (global.fetch as jest.Mock) = jest.fn().mockRejectedValue(new Error('Network failure'));

    const queue = new RequestQueue('http://localhost:8080');
    const updates: string[] = [];
    queue.setUpdateCallback((req) => updates.push(req.status));

    queue.enqueue(createMetadata());
    await new Promise((r) => setTimeout(r, 50));

    expect(updates).toContain('failed');
  });

  it('should mark request as failed on non-ok response', async () => {
    (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    const queue = new RequestQueue('http://localhost:8080');
    const updates: string[] = [];
    queue.setUpdateCallback((req) => updates.push(req.status));

    queue.enqueue(createMetadata());
    await new Promise((r) => setTimeout(r, 50));

    expect(updates).toContain('failed');
  });
});

describe('RequestQueue: Rate Limiting', () => {
  it('should process requests within rate limit', async () => {
    const queue = new RequestQueue('http://localhost:8080');

    // Enqueue 3 requests (well under 30/min limit)
    queue.enqueue(createMetadata());
    queue.enqueue(createMetadata());
    queue.enqueue(createMetadata());

    await new Promise((r) => setTimeout(r, 200));

    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});
