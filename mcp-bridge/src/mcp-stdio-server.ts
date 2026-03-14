/**
 * U:Echo — MCP Stdio Server for Windsurf/Cascade
 *
 * A real Model Context Protocol server that Windsurf launches via mcp_config.json.
 * It exposes U:Echo prompt tools so Cascade can directly access design-change
 * prompts pushed from the Chrome extension.
 *
 * Transport: stdio (JSON-RPC 2.0 over stdin/stdout)
 * Bridge:    Reads from the local HTTP bridge at localhost:3939
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BRIDGE_URL = process.env.UECHO_BRIDGE_URL || 'http://localhost:3939';

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Fetch JSON from the local HTTP bridge.
 * Returns null on connection errors (bridge not running).
 */
async function bridgeFetch<T>(path: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${BRIDGE_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ─── MCP Server Setup ────────────────────────────────────────────

const server = new McpServer({
  name: 'uecho',
  version: '0.2.0',
});

// ─── Tool: get_uecho_prompts ─────────────────────────────────────
// Lists pending design-change prompts pushed from the U:Echo Chrome extension.

server.tool(
  'get_uecho_prompts',
  'List pending UI design-change prompts from the U:Echo Chrome extension. Returns structured prompts with selectors, action types, and developer-ready instructions.',
  {
    status: z.enum(['queued', 'delivered', 'failed']).optional().describe('Filter by prompt status. Default: queued'),
    limit: z.number().min(1).max(50).optional().describe('Max results to return. Default: 10'),
  },
  async ({ status, limit }) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    params.set('limit', String(limit || 10));

    const data = await bridgeFetch<{
      prompts: Array<{
        prompt_id: string;
        ide_target: string;
        feature_name: string;
        selector: string;
        action_type: string;
        status: string;
        created_at: string;
      }>;
      total: number;
    }>(`/prompts?${params}`);

    if (!data) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'U:Echo bridge is not running. Start it with: cd mcp-bridge && npm run dev',
          },
        ],
      };
    }

    if (data.prompts.length === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'No pending prompts. Use the U:Echo Chrome extension to generate design-change prompts.',
          },
        ],
      };
    }

    const summary = data.prompts
      .map(
        (p, i) =>
          `${i + 1}. **${p.feature_name}** (${p.action_type})\n` +
          `   Selector: \`${p.selector}\`\n` +
          `   Status: ${p.status} | ID: ${p.prompt_id}\n` +
          `   Created: ${p.created_at}`
      )
      .join('\n\n');

    return {
      content: [
        {
          type: 'text' as const,
          text: `## U:Echo Pending Prompts (${data.prompts.length})\n\n${summary}`,
        },
      ],
    };
  }
);

// ─── Tool: get_uecho_prompt_detail ───────────────────────────────
// Gets the full formatted prompt content for a specific prompt ID.

server.tool(
  'get_uecho_prompt_detail',
  'Get the full developer-ready prompt content for a specific U:Echo design change. Returns the formatted instruction that should be applied to the codebase.',
  {
    prompt_id: z.string().describe('The prompt ID returned by get_uecho_prompts'),
  },
  async ({ prompt_id }) => {
    const data = await bridgeFetch<{
      prompt_id: string;
      formatted: {
        ide_target: string;
        format: string;
        content: string;
      };
      feature_name: string;
      selector: string;
      action_type: string;
      status: string;
    }>(`/prompts/${prompt_id}`);

    if (!data) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Prompt ${prompt_id} not found. It may have expired or the bridge is not running.`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text' as const,
          text:
            `## U:Echo Design Change: ${data.feature_name}\n\n` +
            `**Selector:** \`${data.selector}\`\n` +
            `**Action:** ${data.action_type}\n` +
            `**Status:** ${data.status}\n\n` +
            `---\n\n` +
            data.formatted.content,
        },
      ],
    };
  }
);

// ─── Tool: apply_uecho_prompt ────────────────────────────────────
// Marks a prompt as delivered (consumed by the IDE) and returns its content.

server.tool(
  'apply_uecho_prompt',
  'Mark a U:Echo prompt as applied/delivered and return its full content for implementation. Call this when you are ready to implement a design change from U:Echo.',
  {
    prompt_id: z.string().describe('The prompt ID to mark as applied'),
  },
  async ({ prompt_id }) => {
    // First get the prompt detail
    const data = await bridgeFetch<{
      prompt_id: string;
      formatted: { content: string };
      feature_name: string;
      selector: string;
      action_type: string;
    }>(`/prompts/${prompt_id}`);

    if (!data) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Prompt ${prompt_id} not found.`,
          },
        ],
      };
    }

    // Mark as delivered via POST
    const deliverRes = await bridgeFetch(`/prompts/${prompt_id}/deliver`, { method: 'POST' });
    const deliveredOk = deliverRes !== null;
    if (!deliveredOk) {
      console.error(`[MCP] Failed to mark prompt ${prompt_id} as delivered`);
    }

    return {
      content: [
        {
          type: 'text' as const,
          text:
            `## Applying U:Echo Change: ${data.feature_name}\n\n` +
            `Please implement the following design change:\n\n` +
            data.formatted.content +
            `\n\n---\n*Prompt ${prompt_id} ${deliveredOk ? 'marked as delivered' : '⚠ delivery confirmation failed'}.*`,
        },
      ],
    };
  }
);

// ─── Tool: uecho_bridge_status ───────────────────────────────────
// Health check for the bridge connection.

server.tool(
  'uecho_bridge_status',
  'Check if the U:Echo local bridge is running and report its status.',
  {},
  async () => {
    const health = await bridgeFetch<{
      status: string;
      version: string;
      queue_size: number;
      supported_ides: string[];
    }>('/health');

    if (!health) {
      return {
        content: [
          {
            type: 'text' as const,
            text: '❌ U:Echo bridge is **not running**.\n\nStart it with:\n```bash\ncd mcp-bridge && npm run dev\n```',
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text' as const,
          text:
            `✅ U:Echo bridge is **running**\n\n` +
            `- Version: ${health.version}\n` +
            `- Queue size: ${health.queue_size}\n` +
            `- Supported IDEs: ${health.supported_ides.join(', ')}`,
        },
      ],
    };
  }
);

// ─── MCP Prompt: uecho_apply ─────────────────────────────────────
// Registers a dynamic MCP prompt so queued U:Echo prompts appear in
// Cascade's prompt picker. When invoked, returns the developer-ready
// instruction for the selected prompt.

server.prompt(
  'uecho_apply',
  'Apply a pending U:Echo design-change prompt. Lists queued prompts and returns the selected one as a developer-ready instruction.',
  {
    prompt_id: z.string().optional().describe('Specific prompt ID to apply. If omitted, returns the most recent queued prompt.'),
  },
  async ({ prompt_id }) => {
    let targetId = prompt_id;

    // If no specific ID, get the most recent queued prompt
    if (!targetId) {
      const list = await bridgeFetch<{
        prompts: Array<{ prompt_id: string; feature_name: string; selector: string; action_type: string; status: string }>;
      }>('/prompts?status=queued&limit=1');

      if (!list || list.prompts.length === 0) {
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: 'No pending U:Echo prompts. Use the Chrome extension to generate design-change prompts first.',
              },
            },
          ],
        };
      }
      targetId = list.prompts[0].prompt_id;
    }

    // Fetch full prompt detail
    const data = await bridgeFetch<{
      prompt_id: string;
      formatted: { content: string };
      feature_name: string;
      selector: string;
      action_type: string;
    }>(`/prompts/${targetId}`);

    if (!data) {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Prompt ${targetId} not found. It may have expired or the bridge is not running.`,
            },
          },
        ],
      };
    }

    // Mark as delivered
    await bridgeFetch(`/prompts/${targetId}/deliver`, { method: 'POST' });

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text:
              `Please implement the following U:Echo design change:\n\n` +
              `**Feature:** ${data.feature_name}\n` +
              `**Selector:** \`${data.selector}\`\n` +
              `**Action:** ${data.action_type}\n\n` +
              `---\n\n` +
              data.formatted.content,
          },
        },
      ],
    };
  }
);

// ─── SSE Bridge Listener ─────────────────────────────────────────
// Connects to the bridge's /events SSE endpoint to receive real-time
// notifications when prompts are queued, delivered, or failed.
// Calls server.sendPromptListChanged() so Cascade knows the prompt
// list has been updated.

let sseRetryTimer: ReturnType<typeof setTimeout> | null = null;
let sseAbortController: AbortController | null = null;
let sseReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
const SSE_RECONNECT_MS = 3000;

function abortCurrentSSE(): void {
  if (sseAbortController) {
    sseAbortController.abort();
    sseAbortController = null;
  }
  if (sseReader) {
    sseReader.cancel().catch(() => {});
    sseReader = null;
  }
}

function connectBridgeSSE(): void {
  // Abort any existing connection before starting a new one
  abortCurrentSSE();

  const url = `${BRIDGE_URL}/events`;
  process.stderr.write(`[U:Echo MCP] Connecting to bridge SSE: ${url}\n`);

  sseAbortController = new AbortController();
  const { signal } = sseAbortController;

  fetch(url, {
    headers: { Accept: 'text/event-stream' },
    signal,
  })
    .then(async (res) => {
      if (!res.ok || !res.body) {
        throw new Error(`SSE connection failed: ${res.status}`);
      }

      process.stderr.write(`[U:Echo MCP] SSE connected\n`);

      const reader = res.body.getReader();
      sseReader = reader;
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('event:')) {
              const event = line.slice(6).trim();
              if (
                event === 'prompt_queued' ||
                event === 'prompt_delivered' ||
                event === 'prompt_failed'
              ) {
                try {
                  server.server.sendPromptListChanged();
                } catch {
                  // Server not connected yet, ignore
                }
              }
            }
          }
        }
      } finally {
        sseReader = null;
      }

      // Stream ended — only reconnect if it wasn't an intentional abort
      if (!signal.aborted) {
        process.stderr.write(`[U:Echo MCP] SSE stream ended, reconnecting...\n`);
        scheduleSseReconnect();
      }
    })
    .catch((err) => {
      if (signal.aborted) return; // Intentional abort, don't reconnect
      process.stderr.write(`[U:Echo MCP] SSE error: ${err}\n`);
      scheduleSseReconnect();
    });
}

function scheduleSseReconnect(): void {
  if (sseRetryTimer) clearTimeout(sseRetryTimer);
  sseRetryTimer = setTimeout(connectBridgeSSE, SSE_RECONNECT_MS);
}

function shutdownSSE(): void {
  if (sseRetryTimer) {
    clearTimeout(sseRetryTimer);
    sseRetryTimer = null;
  }
  abortCurrentSSE();
}

process.on('SIGINT', () => { shutdownSSE(); process.exit(0); });
process.on('SIGTERM', () => { shutdownSSE(); process.exit(0); });
process.on('exit', () => { shutdownSSE(); });

// ─── Start ───────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Start SSE listener after MCP connection is established
  connectBridgeSSE();
}

main().catch((err) => {
  process.stderr.write(`[U:Echo MCP] Fatal: ${err}\n`);
  process.exit(1);
});
