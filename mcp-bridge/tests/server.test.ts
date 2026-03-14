/**
 * U:Echo — MCP Bridge Unit & Integration Tests
 * Tests Express server endpoints, auth middleware, and prompt routing.
 */

import request from 'supertest';
import { app } from '../src/server';
import { formatForIDE, SUPPORTED_IDES } from '../src/adapters';
import type { PromptPayload } from '../src/adapters';
import { clearQueue, queueSize, listPrompts } from '../src/queue';

// ─── Unit Tests: Health Endpoint ─────────────────────────────────
describe('MCP Bridge: Health Endpoint', () => {
  it('should return 200 on GET /health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  it('should return ok status', async () => {
    const res = await request(app).get('/health');
    expect(res.body.status).toBe('ok');
  });

  it('should return service name', async () => {
    const res = await request(app).get('/health');
    expect(res.body.service).toBe('uecho-mcp-bridge');
  });

  it('should return version', async () => {
    const res = await request(app).get('/health');
    expect(res.body.version).toBe('0.2.0');
  });

  it('should return ISO timestamp', async () => {
    const res = await request(app).get('/health');
    expect(res.body.timestamp).toBeDefined();
    // Verify it's a valid ISO string
    const date = new Date(res.body.timestamp);
    expect(date.getTime()).not.toBeNaN();
  });
});

// ─── Unit Tests: Prompt Endpoint ────────────────────────────────
describe('MCP Bridge: Prompt Endpoint', () => {
  const validPayload = {
    prompt_text: 'Resize h1.hero-title from 200x40 to 240x48',
    feature_name: 'Enlarge Hero Title',
    selector: 'h1.hero-title',
    action_type: 'resize',
    ide_target: 'windsurf',
  };

  it('should return 200 for valid prompt', async () => {
    const res = await request(app)
      .post('/prompt')
      .send(validPayload);
    expect(res.status).toBe(200);
  });

  it('should return queued status', async () => {
    const res = await request(app)
      .post('/prompt')
      .send(validPayload);
    expect(res.body.queued).toBe(true);
  });

  it('should return a prompt_id', async () => {
    const res = await request(app)
      .post('/prompt')
      .send(validPayload);
    expect(res.body.prompt_id).toBeDefined();
    expect(typeof res.body.prompt_id).toBe('string');
    expect(res.body.prompt_id.length).toBeGreaterThan(0);
  });

  it('should return accepted/queued status and format', async () => {
    const res = await request(app)
      .post('/prompt')
      .send(validPayload);
    expect(res.body.accepted).toBe(true);
    expect(res.body.delivered).toBe(false);
    expect(res.body.queued).toBe(true);
    expect(res.body.ide_target).toBe('windsurf');
    expect(res.body.format).toBe('markdown');
  });

  it('should reject missing prompt_text with 400', async () => {
    const res = await request(app)
      .post('/prompt')
      .send({
        feature_name: 'Test',
        selector: '.test',
        action_type: 'resize',
        ide_target: 'windsurf',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('prompt_text');
  });

  it('should reject empty prompt_text with 400', async () => {
    const res = await request(app)
      .post('/prompt')
      .send({
        ...validPayload,
        prompt_text: '',
      });
    expect(res.status).toBe(400);
  });

  it('should accept payload with optional metadata', async () => {
    const res = await request(app)
      .post('/prompt')
      .send({
        ...validPayload,
        metadata: { confidence: 0.95, source: 'agent-v1' },
      });
    expect(res.status).toBe(200);
  });
});

// ─── Unit Tests: Auth Middleware ─────────────────────────────────
describe('MCP Bridge: Auth Middleware', () => {
  // Note: When TOKEN env var is empty, auth is bypassed.
  // These tests verify the middleware logic with the current env.

  it('should allow requests when TOKEN is empty (no auth)', async () => {
    // Default test env has no TOKEN set
    const res = await request(app)
      .post('/prompt')
      .send({
        prompt_text: 'Test prompt',
        feature_name: 'Test',
        selector: '.test',
        action_type: 'text',
        ide_target: 'vscode',
      });
    expect(res.status).toBe(200);
  });

  it('should not require auth for health endpoint', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });
});

// ─── Integration Tests: Request Flow ────────────────────────────
describe('MCP Bridge: Integration - Request Flow', () => {
  it('should handle sequential prompt submissions', async () => {
    const prompts = [
      { prompt_text: 'Resize button', feature_name: 'F1', selector: '.btn', action_type: 'resize', ide_target: 'windsurf' },
      { prompt_text: 'Change color', feature_name: 'F2', selector: '.header', action_type: 'color', ide_target: 'cursor' },
      { prompt_text: 'Move element', feature_name: 'F3', selector: '#nav', action_type: 'move', ide_target: 'vscode' },
    ];

    const promptIds = new Set<string>();

    for (const prompt of prompts) {
      const res = await request(app).post('/prompt').send(prompt);
      expect(res.status).toBe(200);
      expect(res.body.prompt_id).toBeDefined();
      promptIds.add(res.body.prompt_id);
    }

    // All prompt IDs should be unique
    expect(promptIds.size).toBe(prompts.length);
  });

  it('should handle all IDE target types', async () => {
    const targets = ['windsurf', 'cursor', 'vscode', 'antigravity', 'generic'];

    for (const target of targets) {
      const res = await request(app)
        .post('/prompt')
        .send({
          prompt_text: `Test for ${target}`,
          feature_name: 'IDE Test',
          selector: '.test',
          action_type: 'text',
          ide_target: target,
        });
      expect(res.status).toBe(200);
    }
  });
});

// ─── IDE Adapters ────────────────────────────────────────────────
describe('MCP Bridge: IDE Adapters', () => {
  const base: PromptPayload = {
    prompt_id: 'test-id',
    prompt_text: 'Resize element to 300x200',
    feature_name: 'Enlarge Card',
    selector: '.card-hero',
    action_type: 'resize',
    ide_target: 'windsurf',
  };

  it('should list supported IDEs', () => {
    expect(SUPPORTED_IDES).toContain('windsurf');
    expect(SUPPORTED_IDES).toContain('cursor');
    expect(SUPPORTED_IDES).toContain('vscode');
    expect(SUPPORTED_IDES).toContain('antigravity');
  });

  it('should format windsurf as markdown', () => {
    const result = formatForIDE({ ...base, ide_target: 'windsurf' });
    expect(result.format).toBe('markdown');
    expect(result.content).toContain('## U:Echo Design Change');
    expect(result.content).toContain('.card-hero');
  });

  it('should format cursor as markdown with @workspace', () => {
    const result = formatForIDE({ ...base, ide_target: 'cursor' });
    expect(result.format).toBe('markdown');
    expect(result.content).toContain('@workspace');
  });

  it('should format vscode as JSON', () => {
    const result = formatForIDE({ ...base, ide_target: 'vscode' });
    expect(result.format).toBe('json');
    const parsed = JSON.parse(result.content);
    expect(parsed.selector).toBe('.card-hero');
  });

  it('should format antigravity as text', () => {
    const result = formatForIDE({ ...base, ide_target: 'antigravity' });
    expect(result.format).toBe('text');
    expect(result.content).toContain('[U:Echo]');
  });

  it('should fall back to generic JSON for unknown IDEs', () => {
    const result = formatForIDE({ ...base, ide_target: 'unknown-ide' });
    expect(result.format).toBe('json');
    expect(result.ide_target).toBe('unknown-ide');
  });

  it('should include prompt_id in metadata', () => {
    const result = formatForIDE(base);
    expect(result.metadata.prompt_id).toBe('test-id');
  });
});

// ─── Prompt Queue ────────────────────────────────────────────────
describe('MCP Bridge: Prompt Queue', () => {
  beforeEach(() => {
    clearQueue();
  });

  it('should track queue size after submissions', async () => {
    const before = queueSize();
    await request(app).post('/prompt').send({
      prompt_text: 'Test', feature_name: 'F', selector: '.x', action_type: 'resize', ide_target: 'windsurf',
    });
    expect(queueSize()).toBe(before + 1);
  });

  it('should return delivered prompts in history', async () => {
    await request(app).post('/prompt').send({
      prompt_text: 'Test', feature_name: 'F', selector: '.x', action_type: 'resize', ide_target: 'windsurf',
    });
    const history = await request(app).get('/prompts');
    expect(history.status).toBe(200);
    expect(history.body.prompts.length).toBeGreaterThan(0);
    expect(history.body.prompts[0].status).toBe('queued');
  });

  it('should filter prompts by status', async () => {
    await request(app).post('/prompt').send({
      prompt_text: 'T1', feature_name: 'F1', selector: '.a', action_type: 'resize', ide_target: 'windsurf',
    });
    const res = await request(app).get('/prompts?status=queued');
    expect(Array.isArray(res.body.prompts)).toBe(true);
    expect(res.body.prompts.length).toBeGreaterThan(0);
    expect(res.body.prompts.every((p: { status: string }) => p.status === 'queued')).toBe(true);
  });

  it('should filter prompts by ide_target', async () => {
    await request(app).post('/prompt').send({
      prompt_text: 'T1', feature_name: 'F1', selector: '.a', action_type: 'resize', ide_target: 'cursor',
    });
    const res = await request(app).get('/prompts?ide_target=cursor');
    expect(Array.isArray(res.body.prompts)).toBe(true);
    expect(res.body.prompts.length).toBeGreaterThan(0);
    expect(res.body.prompts.every((p: { ide_target: string }) => p.ide_target === 'cursor')).toBe(true);
  });
});

// ─── Prompt Detail ───────────────────────────────────────────────
describe('MCP Bridge: Prompt Detail', () => {
  beforeEach(() => {
    clearQueue();
  });

  it('should retrieve a prompt by ID', async () => {
    const submitRes = await request(app).post('/prompt').send({
      prompt_text: 'Detail test', feature_name: 'Detail', selector: '.d', action_type: 'color', ide_target: 'vscode',
    });
    const id = submitRes.body.prompt_id;
    const detailRes = await request(app).get(`/prompts/${id}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.prompt_id).toBe(id);
    expect(detailRes.body.formatted).toBeDefined();
  });

  it('should return 404 for unknown prompt ID', async () => {
    const res = await request(app).get('/prompts/nonexistent-id');
    expect(res.status).toBe(404);
  });
});

// ─── SSE Events ─────────────────────────────────────────────────
describe('MCP Bridge: SSE Events', () => {
  it('should return event-stream content type and connected event', (done) => {
    const server = app.listen(0, async () => {
      try {
        const addr = server.address() as { port: number };
        const url = `http://127.0.0.1:${addr.port}/events`;

        const res = await fetch(url);
        expect(res.headers.get('content-type')).toContain('text/event-stream');

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();

        try {
          const { value } = await reader.read();
          const text = decoder.decode(value);
          expect(text).toContain('event: connected');
        } finally {
          await reader.cancel();
        }

        server.close(done);
      } catch (err) {
        server.close(() => done(err));
      }
    });
  }, 10000);
});

// ─── Delivery Lifecycle ─────────────────────────────────────────
describe('MCP Bridge: Delivery Lifecycle', () => {
  beforeEach(() => {
    clearQueue();
  });

  it('should support full queue → detail → deliver lifecycle', async () => {
    // 1. Queue a prompt
    const queueRes = await request(app)
      .post('/prompt')
      .send({
        prompt_text: 'Make the header font larger',
        feature_name: 'Header Font',
        selector: 'h1.title',
        action_type: 'modify',
        ide_target: 'windsurf',
      });
    expect(queueRes.status).toBe(200);
    const { prompt_id } = queueRes.body;
    expect(prompt_id).toBeDefined();

    // 2. List prompts — should appear as queued
    const listRes = await request(app).get('/prompts?status=queued');
    expect(listRes.body.prompts.length).toBeGreaterThan(0);
    const found = listRes.body.prompts.find((p: { prompt_id: string }) => p.prompt_id === prompt_id);
    expect(found).toBeDefined();
    expect(found.status).toBe('queued');

    // 3. Get detail
    const detailRes = await request(app).get(`/prompts/${prompt_id}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.formatted).toBeDefined();
    expect(detailRes.body.formatted.content).toContain('Header Font');

    // 4. Mark as delivered
    const deliverRes = await request(app).post(`/prompts/${prompt_id}/deliver`);
    expect(deliverRes.status).toBe(200);
    expect(deliverRes.body.status).toBe('delivered');

    // 5. Verify status changed
    const afterRes = await request(app).get(`/prompts/${prompt_id}`);
    expect(afterRes.body.status).toBe('delivered');

    // 6. Should not appear in queued list
    const queuedRes = await request(app).get('/prompts?status=queued');
    const stillQueued = queuedRes.body.prompts.find((p: { prompt_id: string }) => p.prompt_id === prompt_id);
    expect(stillQueued).toBeUndefined();
  });

  it('should support queue → fail lifecycle', async () => {
    const queueRes = await request(app)
      .post('/prompt')
      .send({
        prompt_text: 'Test fail flow',
        feature_name: 'Fail Test',
        selector: '.fail',
        action_type: 'resize',
        ide_target: 'cursor',
      });
    const { prompt_id } = queueRes.body;

    const failRes = await request(app)
      .post(`/prompts/${prompt_id}/fail`)
      .send({ error: 'Implementation rejected by user' });
    expect(failRes.status).toBe(200);
    expect(failRes.body.status).toBe('failed');

    const detailRes = await request(app).get(`/prompts/${prompt_id}`);
    expect(detailRes.body.status).toBe('failed');
    expect(detailRes.body.error).toBe('Implementation rejected by user');
  });

  it('should return 404 for deliver on unknown ID', async () => {
    const res = await request(app).post('/prompts/nonexistent-id/deliver');
    expect(res.status).toBe(404);
  });

  it('should return 404 for fail on unknown ID', async () => {
    const res = await request(app)
      .post('/prompts/nonexistent-id/fail')
      .send({ error: 'test' });
    expect(res.status).toBe(404);
  });
});

// ─── Health Extended ─────────────────────────────────────────────
describe('MCP Bridge: Health Extended', () => {
  it('should include supported_ides in health', async () => {
    const res = await request(app).get('/health');
    expect(res.body.supported_ides).toBeDefined();
    expect(res.body.supported_ides).toContain('windsurf');
  });

  it('should include queue_size in health', async () => {
    const res = await request(app).get('/health');
    expect(typeof res.body.queue_size).toBe('number');
  });
});

// ─── Performance Tests ──────────────────────────────────────────
describe('MCP Bridge: Performance', () => {
  it('should respond to health in under 50ms', async () => {
    const start = performance.now();
    await request(app).get('/health');
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it('should respond to prompt in under 100ms', async () => {
    const start = performance.now();
    await request(app)
      .post('/prompt')
      .send({
        prompt_text: 'Perf test prompt',
        feature_name: 'Perf',
        selector: '.perf',
        action_type: 'resize',
        ide_target: 'windsurf',
      });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });
});
