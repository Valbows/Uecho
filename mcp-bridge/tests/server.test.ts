/**
 * U:Echo — MCP Bridge Unit & Integration Tests
 * Tests Express server endpoints, auth middleware, and prompt routing.
 */

import request from 'supertest';
import { app } from '../src/server';

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
    expect(res.body.version).toBe('0.1.0');
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

  it('should indicate delivery not yet implemented', async () => {
    const res = await request(app)
      .post('/prompt')
      .send(validPayload);
    expect(res.body.delivered).toBe(false);
    expect(res.body.reason).toContain('not yet implemented');
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
