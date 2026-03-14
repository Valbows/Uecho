/**
 * U:Echo — Shared Constants
 */

export const EXTENSION_NAME = 'U:Echo';
export const EXTENSION_VERSION = '0.1.0';

// Host patterns for content script injection
export const LOCALHOST_PATTERNS = [
  'http://localhost/*',
  'http://127.0.0.1/*',
];

// Default settings
export const DEFAULT_GRID_CELL_SIZE = 1; // px
export const DEFAULT_OVERLAY_MODE = 'off' as const;
export const DEFAULT_IDE_TARGET = 'windsurf' as const;

// Backend API URL (FastAPI server)
export const BACKEND_URL = 'http://localhost:8080';

// MCP bridge URL (local service that queues prompts for IDE delivery)
export const MCP_BRIDGE_URL = 'http://localhost:3939';

// Backend endpoints
export const API_ENDPOINTS = {
  health: '/api/health',
  processGesture: '/api/process-gesture',
  enhanceText: '/api/enhance-text',
  generatePrompt: '/api/generate-prompt',
  sendToIde: '/api/send-to-ide',
  uploadScreenshot: '/api/upload-screenshot',
  exportCsv: '/api/export/csv',
  webhookSend: '/api/webhook/send',
} as const;

// Agent pipeline
export const SEMANTIC_DRIFT_THRESHOLD = 0.80;
export const MAX_AGENT_INVOCATIONS_PER_MINUTE = 10;
export const AGENT_RETRY_COUNT = 2;

// Embedding
export const EMBEDDING_DIMENSIONS = 3072;
export const VECTOR_SEARCH_TOP_K = 3;
export const VECTOR_SIMILARITY_THRESHOLD = 0.75;

// Performance
export const OVERLAY_TARGET_FPS = 60;
export const PROMPT_TURNAROUND_TARGET_MS = 5000;
export const EMBEDDING_LATENCY_TARGET_MS = 1000;
export const VECTOR_SEARCH_LATENCY_TARGET_MS = 500;

// Storage keys (chrome.storage.local)
export const STORAGE_KEYS = {
  session: 'uecho_session',
  settings: 'uecho_settings',
  onboarding_complete: 'uecho_onboarding_complete',
  cached_embeddings: 'uecho_cached_embeddings',
  chat_messages: 'uecho_chat_messages',
} as const;
