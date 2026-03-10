/**
 * U:Echo — IDE Adapters
 * Formats confirmed prompts for delivery to specific IDE targets.
 * Each adapter transforms the canonical PromptPayload into the format
 * expected by that IDE's extension/plugin API.
 */

export interface PromptPayload {
  prompt_id: string;
  prompt_text: string;
  feature_name: string;
  selector: string;
  action_type: string;
  ide_target: string;
  metadata?: Record<string, unknown>;
}

export interface FormattedPrompt {
  ide_target: string;
  format: string;
  content: string;
  metadata: Record<string, unknown>;
}

// ─── Windsurf Adapter ─────────────────────────────────────────────
// Windsurf uses Cascade chat — format as a markdown instruction block
function formatWindsurf(payload: PromptPayload): FormattedPrompt {
  const content = [
    `## U:Echo Design Change: ${payload.feature_name}`,
    '',
    '```yaml',
    `selector: "${payload.selector}"`,
    `action: ${payload.action_type}`,
    '```',
    '',
    payload.prompt_text,
  ].join('\n');

  return {
    ide_target: 'windsurf',
    format: 'markdown',
    content,
    metadata: { ...payload.metadata, prompt_id: payload.prompt_id },
  };
}

// ─── Cursor Adapter ───────────────────────────────────────────────
// Cursor uses composer — format as structured instruction
function formatCursor(payload: PromptPayload): FormattedPrompt {
  const content = [
    `@workspace Apply the following UI change:`,
    '',
    `**Feature:** ${payload.feature_name}`,
    `**Selector:** \`${payload.selector}\``,
    `**Action:** ${payload.action_type}`,
    '',
    payload.prompt_text,
  ].join('\n');

  return {
    ide_target: 'cursor',
    format: 'markdown',
    content,
    metadata: { ...payload.metadata, prompt_id: payload.prompt_id },
  };
}

// ─── VS Code Adapter ─────────────────────────────────────────────
// VS Code uses Copilot chat — format as JSON-LD style instruction
function formatVSCode(payload: PromptPayload): FormattedPrompt {
  const content = JSON.stringify(
    {
      instruction: 'Apply UI change',
      feature_name: payload.feature_name,
      selector: payload.selector,
      action_type: payload.action_type,
      prompt: payload.prompt_text,
    },
    null,
    2
  );

  return {
    ide_target: 'vscode',
    format: 'json',
    content,
    metadata: { ...payload.metadata, prompt_id: payload.prompt_id },
  };
}

// ─── Antigravity Adapter ──────────────────────────────────────────
// Antigravity uses natural language input — format as plain instruction
function formatAntigravity(payload: PromptPayload): FormattedPrompt {
  const content = [
    `[U:Echo] ${payload.feature_name}`,
    `Target: ${payload.selector} (${payload.action_type})`,
    '',
    payload.prompt_text,
  ].join('\n');

  return {
    ide_target: 'antigravity',
    format: 'text',
    content,
    metadata: { ...payload.metadata, prompt_id: payload.prompt_id },
  };
}

// ─── Generic Fallback ─────────────────────────────────────────────
function formatGeneric(payload: PromptPayload): FormattedPrompt {
  return {
    ide_target: payload.ide_target,
    format: 'json',
    content: JSON.stringify(payload, null, 2),
    metadata: { ...payload.metadata, prompt_id: payload.prompt_id },
  };
}

// ─── Adapter Router ───────────────────────────────────────────────
const ADAPTERS: Record<string, (p: PromptPayload) => FormattedPrompt> = {
  windsurf: formatWindsurf,
  cursor: formatCursor,
  vscode: formatVSCode,
  antigravity: formatAntigravity,
};

export function formatForIDE(payload: PromptPayload): FormattedPrompt {
  const adapter = ADAPTERS[payload.ide_target] || formatGeneric;
  return adapter(payload);
}

export const SUPPORTED_IDES = Object.keys(ADAPTERS);
