/**
 * U:Echo — Unit Tests: Type Guards & Validation
 * Tests runtime type validation helpers for the FR-10 prompt schema.
 */

import type {
  BoundingBox,
  GestureEvent,
  PromptSchema,
  VerificationResult,
  OverlayMode,
  IDETarget,
  ActionType,
  ConnectivityStatus,
  UserSettings,
  EchoSession,
  RequestRecord,
} from '../../src/shared/types';

// ─── Type Guard Helpers (tested inline) ─────────────────────────
function isValidBoundingBox(obj: unknown): obj is BoundingBox {
  if (typeof obj !== 'object' || obj === null) return false;
  const bb = obj as Record<string, unknown>;
  return (
    typeof bb.x === 'number' &&
    typeof bb.y === 'number' &&
    typeof bb.width === 'number' &&
    typeof bb.height === 'number' &&
    bb.width >= 0 &&
    bb.height >= 0
  );
}

function isValidOverlayMode(mode: string): mode is OverlayMode {
  return ['grid', 'divbox', 'off'].includes(mode);
}

function isValidIDETarget(target: string): target is IDETarget {
  return ['vscode', 'cursor', 'windsurf', 'antigravity', 'generic'].includes(target);
}

function isValidActionType(type: string): type is ActionType {
  return ['resize', 'move', 'text', 'color', 'image', 'code'].includes(type);
}

describe('Type Validation: BoundingBox', () => {
  it('should accept a valid bounding box', () => {
    const bb: BoundingBox = { x: 10, y: 20, width: 100, height: 50 };
    expect(isValidBoundingBox(bb)).toBe(true);
  });

  it('should accept zero-dimension bounding box', () => {
    const bb: BoundingBox = { x: 0, y: 0, width: 0, height: 0 };
    expect(isValidBoundingBox(bb)).toBe(true);
  });

  it('should reject null', () => {
    expect(isValidBoundingBox(null)).toBe(false);
  });

  it('should reject missing fields', () => {
    expect(isValidBoundingBox({ x: 10, y: 20 })).toBe(false);
  });

  it('should reject negative dimensions', () => {
    expect(isValidBoundingBox({ x: 0, y: 0, width: -1, height: 10 })).toBe(false);
  });

  it('should reject string values', () => {
    expect(isValidBoundingBox({ x: '10', y: 20, width: 100, height: 50 })).toBe(false);
  });
});

describe('Type Validation: OverlayMode', () => {
  it('should accept grid', () => expect(isValidOverlayMode('grid')).toBe(true));
  it('should accept divbox', () => expect(isValidOverlayMode('divbox')).toBe(true));
  it('should accept off', () => expect(isValidOverlayMode('off')).toBe(true));
  it('should reject unknown modes', () => expect(isValidOverlayMode('freeform')).toBe(false));
  it('should reject empty string', () => expect(isValidOverlayMode('')).toBe(false));
});

describe('Type Validation: IDETarget', () => {
  it('should accept all 5 IDE targets', () => {
    ['vscode', 'cursor', 'windsurf', 'antigravity', 'generic'].forEach((t) => {
      expect(isValidIDETarget(t)).toBe(true);
    });
  });

  it('should reject invalid IDE targets', () => {
    expect(isValidIDETarget('sublime')).toBe(false);
    expect(isValidIDETarget('intellij')).toBe(false);
  });
});

describe('Type Validation: ActionType', () => {
  it('should accept all 6 action types', () => {
    ['resize', 'move', 'text', 'color', 'image', 'code'].forEach((a) => {
      expect(isValidActionType(a)).toBe(true);
    });
  });

  it('should reject invalid action types', () => {
    expect(isValidActionType('delete')).toBe(false);
    expect(isValidActionType('')).toBe(false);
  });
});

describe('Type Structures: GestureEvent', () => {
  it('should create a valid gesture event object', () => {
    const gesture: GestureEvent = {
      type: 'resize',
      selector: '.hero-title',
      before_bbox: { x: 0, y: 0, width: 200, height: 40 },
      after_bbox: { x: 0, y: 0, width: 240, height: 48 },
      delta: { resize_right: 40, resize_bottom: 8 },
      timestamp: Date.now(),
    };
    expect(gesture.type).toBe('resize');
    expect(isValidBoundingBox(gesture.before_bbox)).toBe(true);
    expect(isValidBoundingBox(gesture.after_bbox)).toBe(true);
    expect(gesture.timestamp).toBeGreaterThan(0);
  });
});

describe('Type Structures: PromptSchema (FR-10)', () => {
  it('should have all required fields populated', () => {
    const prompt: PromptSchema = {
      feature_name: 'Enlarge Hero Title',
      selector: 'h1.hero-title',
      action_type: 'resize',
      current_dimensions: { x: 0, y: 0, width: 200, height: 40 },
      target_dimensions: { width: 240, height: 48 },
      visual_change_description: 'Make the hero title 20% larger and semi-bold',
      screenshots: ['gs://bucket/shot1.png'],
      retrieved_examples_used: ['example-prompt-42'],
      tab_url: 'http://localhost:3000',
      scroll_position: { x: 0, y: 0 },
      extension_session_id: 'sess-abc123',
      prompt_text: 'Resize h1.hero-title from 200x40 to 240x48.',
    };

    expect(prompt.feature_name).toBeTruthy();
    expect(prompt.selector).toBeTruthy();
    expect(isValidActionType(prompt.action_type)).toBe(true);
    expect(isValidBoundingBox(prompt.current_dimensions)).toBe(true);
    expect(prompt.prompt_text.length).toBeGreaterThan(0);
  });
});

describe('Type Structures: VerificationResult', () => {
  it('should indicate a fully passing verification', () => {
    const result: VerificationResult = {
      schema_valid: true,
      safety_passed: true,
      consistency_passed: true,
      semantic_drift_score: 0.92,
      drift_warning: false,
      errors: [],
      warnings: [],
    };
    expect(result.schema_valid).toBe(true);
    expect(result.drift_warning).toBe(false);
    expect(result.semantic_drift_score).toBeGreaterThanOrEqual(0.80);
  });

  it('should flag drift warning when score < 0.80', () => {
    const result: VerificationResult = {
      schema_valid: true,
      safety_passed: true,
      consistency_passed: true,
      semantic_drift_score: 0.65,
      drift_warning: true,
      errors: [],
      warnings: ['Semantic drift detected'],
    };
    expect(result.drift_warning).toBe(true);
    expect(result.semantic_drift_score).toBeLessThan(0.80);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('Type Structures: ConnectivityStatus', () => {
  it('should represent all-connected state', () => {
    const status: ConnectivityStatus = { extension: true, backend: true, ide_bridge: true };
    expect(Object.values(status).every(Boolean)).toBe(true);
  });

  it('should represent partial connection', () => {
    const status: ConnectivityStatus = { extension: true, backend: true, ide_bridge: false };
    expect(status.ide_bridge).toBe(false);
  });
});

describe('Type Structures: UserSettings', () => {
  it('should have valid defaults', () => {
    const settings: UserSettings = {
      grid_cell_size: 25,
      overlay_mode: 'off',
      ide_target: 'windsurf',
    };
    expect(settings.grid_cell_size).toBeGreaterThan(0);
    expect(isValidOverlayMode(settings.overlay_mode)).toBe(true);
    expect(isValidIDETarget(settings.ide_target)).toBe(true);
  });
});

describe('Type Structures: EchoSession', () => {
  it('should create a valid session object', () => {
    const session: EchoSession = {
      session_id: 'sess-001',
      user_id: 'user-001',
      tab_url: 'http://localhost:3000',
      overlay_mode: 'grid',
      agent_active: true,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    expect(session.session_id).toBeTruthy();
    expect(session.updated_at).toBeGreaterThanOrEqual(session.created_at);
  });
});

describe('Type Structures: RequestRecord', () => {
  it('should create a valid request record', () => {
    const record: RequestRecord = {
      request_id: 'req-001',
      session_id: 'sess-001',
      action_type: 'resize',
      selector: '#submit-order-btn',
      interpreted_intent: 'Purchase Conversion',
      status: 'verified',
      created_at: Date.now() - 10000,
      updated_at: Date.now(),
    };
    expect(record.status).toBe('verified');
    expect(['pending', 'processing', 'verified', 'sent', 'failed']).toContain(record.status);
  });
});
