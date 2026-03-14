#!/usr/bin/env node
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

// ─── Start ───────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`[U:Echo MCP] Fatal: ${err}\n`);
  process.exit(1);
});
