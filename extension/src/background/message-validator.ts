/**
 * U:Echo — Runtime Message Validation
 * Validates incoming chrome.runtime messages before processing.
 * TypeScript types are compile-time only; this provides runtime safety.
 */

// All valid message types the service worker accepts
const VALID_CS_TYPES = new Set([
  'CS_GESTURE_EVENT',
  'CS_ELEMENT_HOVER',
  'CS_OVERLAY_READY',
]);

const VALID_SP_TYPES = new Set([
  'SP_ACTIVATE_AGENT',
  'SP_DEACTIVATE_AGENT',
  'SP_SUBMIT_TEXT',
  'SP_ENHANCE_TEXT',
  'SP_CONFIRM_PROMPT',
  'SP_UPDATE_SETTINGS',
  'SP_CHECK_CONNECTIVITY',
  'SP_EXPORT_CSV',
  'SP_VOICE_START',
  'SP_VOICE_STOP',
  'SP_VOICE_CHECK_SUPPORT',
]);

// Messages sent FROM the offscreen document back to the service worker
const VALID_OFFSCREEN_TYPES = new Set([
  'VOICE_STATUS',
  'VOICE_TRANSCRIPT',
]);

const ALL_VALID_TYPES = new Set([...VALID_CS_TYPES, ...VALID_SP_TYPES, ...VALID_OFFSCREEN_TYPES]);

const MAX_STRING_LENGTH = 10_000;
const MAX_PROMPT_TEXT_LENGTH = 5_000;
const MAX_FEATURE_NAME_LENGTH = 200;
const MAX_SELECTOR_LENGTH = 500;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate that a message has a known type and comes from the extension.
 */
export function validateMessage(
  message: unknown,
  sender: chrome.runtime.MessageSender
): ValidationResult {
  // Must be an object with a type field
  if (!message || typeof message !== 'object' || !('type' in message)) {
    return { valid: false, error: 'Message missing type field' };
  }

  const msg = message as { type: string };

  if (typeof msg.type !== 'string') {
    return { valid: false, error: 'Message type must be a string' };
  }

  // Reject unknown message types
  if (!ALL_VALID_TYPES.has(msg.type)) {
    return { valid: false, error: `Unknown message type: ${msg.type}` };
  }

  // Content script messages must come from a tab
  if (VALID_CS_TYPES.has(msg.type) && !sender.tab?.id) {
    return { valid: false, error: 'Content script message missing tab context' };
  }

  // Must originate from our extension
  if (sender.id !== chrome.runtime.id) {
    return { valid: false, error: 'Message from unknown extension' };
  }

  return { valid: true };
}

/**
 * Sanitize a string: trim, enforce max length, strip control characters.
 */
export function sanitizeString(value: unknown, maxLength = MAX_STRING_LENGTH): string {
  if (typeof value !== 'string') return '';
  // Strip control characters except newline/tab
  const cleaned = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return cleaned.trim().slice(0, maxLength);
}

/**
 * Validate payload for SP_SUBMIT_TEXT messages.
 */
export function validateSubmitText(payload: unknown): ValidationResult {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Missing payload' };
  }
  const p = payload as Record<string, unknown>;
  if (typeof p.text !== 'string' || p.text.trim().length === 0) {
    return { valid: false, error: 'Text field is required and must be non-empty' };
  }
  if (p.text.length > MAX_PROMPT_TEXT_LENGTH) {
    return { valid: false, error: `Text exceeds max length (${MAX_PROMPT_TEXT_LENGTH})` };
  }
  return { valid: true };
}

/**
 * Validate payload for SP_CONFIRM_PROMPT messages.
 */
export function validateConfirmPrompt(payload: unknown): ValidationResult {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Missing payload' };
  }
  const p = payload as Record<string, unknown>;

  if (!p.prompt || typeof p.prompt !== 'object') {
    return { valid: false, error: 'Missing prompt object' };
  }

  const prompt = p.prompt as Record<string, unknown>;
  if (typeof prompt.prompt_text !== 'string' || !prompt.prompt_text.trim()) {
    return { valid: false, error: 'Prompt text is required' };
  }
  if (prompt.prompt_text.length > MAX_PROMPT_TEXT_LENGTH) {
    return { valid: false, error: `Prompt text too long (max ${MAX_PROMPT_TEXT_LENGTH})` };
  }
  if (typeof prompt.feature_name !== 'string' || !prompt.feature_name.trim()) {
    return { valid: false, error: 'Feature name is required' };
  }
  if (prompt.feature_name.length > MAX_FEATURE_NAME_LENGTH) {
    return { valid: false, error: `Feature name too long (max ${MAX_FEATURE_NAME_LENGTH})` };
  }
  if (typeof prompt.selector !== 'string' || !prompt.selector.trim()) {
    return { valid: false, error: 'Selector is required' };
  }
  if (prompt.selector.length > MAX_SELECTOR_LENGTH) {
    return { valid: false, error: `Selector too long (max ${MAX_SELECTOR_LENGTH})` };
  }

  const validTargets = new Set(['windsurf', 'cursor', 'vscode', 'antigravity', 'generic']);
  if (typeof p.ide_target === 'string' && !validTargets.has(p.ide_target)) {
    return { valid: false, error: `Invalid ide_target: ${p.ide_target}` };
  }

  return { valid: true };
}

/**
 * Validate payload for SP_ACTIVATE_AGENT messages.
 */
export function validateActivateAgent(payload: unknown): ValidationResult {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Missing payload' };
  }
  const p = payload as Record<string, unknown>;
  const validModes = new Set(['grid', 'divbox', 'off']);
  if (typeof p.mode !== 'string' || !validModes.has(p.mode)) {
    return { valid: false, error: `Invalid overlay mode: ${String(p.mode)}` };
  }
  return { valid: true };
}
