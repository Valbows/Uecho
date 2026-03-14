/**
 * U:Echo — Unit Tests: Shared Constants
 */

import {
  EXTENSION_NAME,
  EXTENSION_VERSION,
  DEFAULT_GRID_CELL_SIZE,
  DEFAULT_OVERLAY_MODE,
  DEFAULT_IDE_TARGET,
  API_ENDPOINTS,
  SEMANTIC_DRIFT_THRESHOLD,
  MAX_AGENT_INVOCATIONS_PER_MINUTE,
  EMBEDDING_DIMENSIONS,
  VECTOR_SEARCH_TOP_K,
  OVERLAY_TARGET_FPS,
  PROMPT_TURNAROUND_TARGET_MS,
  STORAGE_KEYS,
  LOCALHOST_PATTERNS,
} from '../../src/shared/constants';

describe('Shared Constants', () => {
  describe('Extension Metadata', () => {
    it('should have correct extension name', () => {
      expect(EXTENSION_NAME).toBe('U:Echo');
    });

    it('should have a valid semver version', () => {
      expect(EXTENSION_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('Default Settings', () => {
    it('should have a positive grid cell size', () => {
      expect(DEFAULT_GRID_CELL_SIZE).toBeGreaterThan(0);
      expect(DEFAULT_GRID_CELL_SIZE).toBe(1);
    });

    it('should default overlay mode to off', () => {
      expect(DEFAULT_OVERLAY_MODE).toBe('off');
    });

    it('should default IDE target to windsurf', () => {
      expect(DEFAULT_IDE_TARGET).toBe('windsurf');
    });
  });

  describe('API Endpoints', () => {
    it('should define all required endpoints', () => {
      expect(API_ENDPOINTS.health).toBeDefined();
      expect(API_ENDPOINTS.processGesture).toBeDefined();
      expect(API_ENDPOINTS.enhanceText).toBeDefined();
      expect(API_ENDPOINTS.sendToIde).toBeDefined();
      expect(API_ENDPOINTS.uploadScreenshot).toBeDefined();
      expect(API_ENDPOINTS.exportCsv).toBeDefined();
      expect(API_ENDPOINTS.webhookSend).toBeDefined();
    });

    it('should have endpoints starting with /api/', () => {
      Object.values(API_ENDPOINTS).forEach((endpoint) => {
        expect(endpoint).toMatch(/^\/api\//);
      });
    });
  });

  describe('Agent Pipeline Constants', () => {
    it('should have drift threshold between 0 and 1', () => {
      expect(SEMANTIC_DRIFT_THRESHOLD).toBeGreaterThan(0);
      expect(SEMANTIC_DRIFT_THRESHOLD).toBeLessThanOrEqual(1);
      expect(SEMANTIC_DRIFT_THRESHOLD).toBe(0.80);
    });

    it('should have positive rate limit', () => {
      expect(MAX_AGENT_INVOCATIONS_PER_MINUTE).toBeGreaterThan(0);
    });

    it('should use 3072-dimensional embeddings', () => {
      expect(EMBEDDING_DIMENSIONS).toBe(3072);
    });

    it('should retrieve top-3 vector results', () => {
      expect(VECTOR_SEARCH_TOP_K).toBe(3);
    });
  });

  describe('Performance Targets', () => {
    it('should target 60fps overlay rendering', () => {
      expect(OVERLAY_TARGET_FPS).toBe(60);
    });

    it('should target prompt turnaround under 5 seconds', () => {
      expect(PROMPT_TURNAROUND_TARGET_MS).toBeLessThanOrEqual(5000);
    });
  });

  describe('Storage Keys', () => {
    it('should define all required storage keys', () => {
      expect(STORAGE_KEYS.session).toBeDefined();
      expect(STORAGE_KEYS.settings).toBeDefined();
      expect(STORAGE_KEYS.onboarding_complete).toBeDefined();
      expect(STORAGE_KEYS.cached_embeddings).toBeDefined();
    });

    it('should prefix all keys with uecho_', () => {
      Object.values(STORAGE_KEYS).forEach((key) => {
        expect(key).toMatch(/^uecho_/);
      });
    });
  });

  describe('Localhost Patterns', () => {
    it('should include localhost and 127.0.0.1', () => {
      expect(LOCALHOST_PATTERNS).toContain('http://localhost/*');
      expect(LOCALHOST_PATTERNS).toContain('http://127.0.0.1/*');
    });
  });
});
