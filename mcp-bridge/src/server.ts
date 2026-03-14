/**
 * U:Echo — MCP Bridge Server
 * Local service that receives confirmed prompts from the backend
 * and delivers them to the developer's IDE via MCP protocol.
 */

import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { formatForIDE, SUPPORTED_IDES } from './adapters';
import {
  enqueue,
  markDelivered,
  markFailed,
  getPrompt,
  listPrompts,
  queueSize,
} from './queue';

config();

const app = express();
const PORT = parseInt(process.env.MCP_BRIDGE_PORT || '3939', 10);
const TOKEN = process.env.MCP_BRIDGE_TOKEN || '';

app.use(cors());
app.use(express.json());

// ─── SSE Clients ────────────────────────────────────────────────
type SSEClient = express.Response;
const sseClients: Set<SSEClient> = new Set();

function broadcastSSE(event: string, data: unknown): void {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    if (client.writableEnded || client.writableFinished) {
      sseClients.delete(client);
      continue;
    }
    try {
      client.write(msg);
    } catch {
      sseClients.delete(client);
      client.destroy();
    }
  }
}

// ─── Auth Middleware ─────────────────────────────────────────────
function authMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  if (TOKEN && req.headers.authorization !== `Bearer ${TOKEN}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

// ─── Health ─────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'uecho-mcp-bridge',
    version: '0.2.0',
    timestamp: new Date().toISOString(),
    supported_ides: SUPPORTED_IDES,
    queue_size: queueSize(),
  });
});

// ─── SSE: Delivery Events ───────────────────────────────────────
app.get('/events', authMiddleware, (_req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.add(res);
  res.write(`event: connected\ndata: ${JSON.stringify({ queue_size: queueSize() })}\n\n`);

  const cleanup = () => { sseClients.delete(res); };
  _req.on('close', cleanup);
  res.on('error', cleanup);
});

// ─── Receive Prompt ─────────────────────────────────────────────
interface IncomingPrompt {
  prompt_text: string;
  feature_name: string;
  selector: string;
  action_type: string;
  ide_target: string;
  metadata?: Record<string, unknown>;
}

app.post('/prompt', authMiddleware, (req, res) => {
  const payload = req.body as IncomingPrompt;

  if (!payload.prompt_text) {
    res.status(400).json({ error: 'prompt_text is required' });
    return;
  }

  const prompt_id = crypto.randomUUID();

  // Format for target IDE
  const formatted = formatForIDE({ ...payload, prompt_id });

  // Enqueue with status tracking
  const entry = enqueue(prompt_id, formatted, {
    feature_name: payload.feature_name,
    selector: payload.selector,
    action_type: payload.action_type,
  });

  console.log(`[MCP Bridge] Queued prompt ${prompt_id} for ${payload.ide_target}`);
  console.log(`  Feature: ${payload.feature_name}`);
  console.log(`  Action: ${payload.action_type}`);
  console.log(`  Selector: ${payload.selector}`);

  broadcastSSE('prompt_queued', { prompt_id, ide_target: payload.ide_target });

  res.json({
    accepted: true,
    delivered: false,
    queued: true,
    prompt_id,
    ide_target: formatted.ide_target,
    format: formatted.format,
  });
});

// ─── Prompt History ─────────────────────────────────────────────
app.get('/prompts', authMiddleware, (req, res) => {
  const { status, ide_target, limit } = req.query;

  const VALID_STATUSES = ['queued', 'delivered', 'failed'] as const;
  const validStatus = typeof status === 'string' && VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])
    ? (status as typeof VALID_STATUSES[number])
    : undefined;
  const validIdeTarget = typeof ide_target === 'string' && ide_target.length > 0
    ? ide_target
    : undefined;
  const parsedLimit = typeof limit === 'string' ? parseInt(limit, 10) : NaN;
  const validLimit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.min(parsedLimit, 100)
    : 50;

  const results = listPrompts({
    status: validStatus,
    ide_target: validIdeTarget,
    limit: validLimit,
  });

  res.json({
    prompts: results.map((p) => ({
      prompt_id: p.prompt_id,
      ide_target: p.ide_target,
      feature_name: p.feature_name,
      selector: p.selector,
      action_type: p.action_type,
      status: p.status,
      created_at: p.created_at,
      updated_at: p.updated_at,
      error: p.error,
    })),
    total: results.length,
  });
});

// ─── Single Prompt Detail ───────────────────────────────────────
app.get('/prompts/:id', authMiddleware, (req: express.Request<{ id: string }>, res) => {
  const entry = getPrompt(req.params.id);
  if (!entry) {
    res.status(404).json({ error: 'Prompt not found' });
    return;
  }
  res.json(entry);
});

// ─── Mark Delivered ─────────────────────────────────────────────
app.post('/prompts/:id/deliver', authMiddleware, (req: express.Request<{ id: string }>, res) => {
  const entry = markDelivered(req.params.id);
  if (!entry) {
    res.status(404).json({ error: 'Prompt not found' });
    return;
  }
  console.log(`[MCP Bridge] Prompt ${req.params.id} marked as delivered`);
  broadcastSSE('prompt_delivered', { prompt_id: req.params.id });
  res.json({ ok: true, prompt_id: entry.prompt_id, status: entry.status });
});

// ─── Mark Failed ────────────────────────────────────────────────
app.post('/prompts/:id/fail', authMiddleware, (req: express.Request<{ id: string }>, res) => {
  const { error: errorMsg } = req.body as { error?: string };
  const finalError = errorMsg || 'Unknown failure';
  const entry = markFailed(req.params.id, finalError);
  if (!entry) {
    res.status(404).json({ error: 'Prompt not found' });
    return;
  }
  console.log(`[MCP Bridge] Prompt ${req.params.id} marked as failed: ${finalError}`);
  broadcastSSE('prompt_failed', { prompt_id: req.params.id, error: finalError });
  res.json({ ok: true, prompt_id: entry.prompt_id, status: entry.status });
});

// ─── Export for testing ──────────────────────────────────────────
export { app, PORT, TOKEN };

// ─── Start (only when run directly) ─────────────────────────────
const isMainModule =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'));

if (isMainModule) {
  app.listen(PORT, () => {
    console.log(`[MCP Bridge] Listening on http://localhost:${PORT}`);
    console.log(`[MCP Bridge] Auth: ${TOKEN ? 'enabled' : 'disabled'}`);
  });
}
