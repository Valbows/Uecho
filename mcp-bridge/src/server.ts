/**
 * U:Echo — MCP Bridge Server
 * Local service that receives confirmed prompts from the backend
 * and delivers them to the developer's IDE via MCP protocol.
 */

import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';

config();

const app = express();
const PORT = parseInt(process.env.MCP_BRIDGE_PORT || '3939', 10);
const TOKEN = process.env.MCP_BRIDGE_TOKEN || '';

app.use(cors());
app.use(express.json());

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
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

// ─── Receive Prompt ─────────────────────────────────────────────
interface PromptPayload {
  prompt_text: string;
  feature_name: string;
  selector: string;
  action_type: string;
  ide_target: string;
  metadata?: Record<string, unknown>;
}

app.post('/prompt', authMiddleware, (req, res) => {
  const payload = req.body as PromptPayload;

  if (!payload.prompt_text) {
    res.status(400).json({ error: 'prompt_text is required' });
    return;
  }

  // TODO: Phase 7 — route to IDE adapter based on ide_target
  console.log(`[MCP Bridge] Received prompt for ${payload.ide_target}:`);
  console.log(`  Feature: ${payload.feature_name}`);
  console.log(`  Action: ${payload.action_type}`);
  console.log(`  Selector: ${payload.selector}`);

  res.json({
    delivered: false,
    reason: 'IDE adapters not yet implemented',
    queued: true,
    prompt_id: crypto.randomUUID(),
  });
});

// ─── Start ──────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[MCP Bridge] Listening on http://localhost:${PORT}`);
  console.log(`[MCP Bridge] Auth: ${TOKEN ? 'enabled' : 'disabled'}`);
});
