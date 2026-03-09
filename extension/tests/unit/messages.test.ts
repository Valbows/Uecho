/**
 * U:Echo — Unit Tests: Chrome Message Protocol
 * Validates message shape contracts between extension layers.
 */

import type {
  CSGestureMessage,
  CSOverlayReadyMessage,
  SWActivateOverlayMessage,
  SWDeactivateOverlayMessage,
  SWAgentResponseMessage,
  SWIntentPopulateMessage,
  SPActivateAgentMessage,
  SPSubmitTextMessage,
  SPConfirmPromptMessage,
  SPCheckConnectivityMessage,
  EchoMessage,
} from '../../src/shared/messages';
import type { GestureEvent, PromptSchema } from '../../src/shared/types';

// ─── Helper: Message Type Discriminator ─────────────────────────
function getMessageType(msg: EchoMessage): string {
  return msg.type;
}

describe('Message Protocol: Content Script Messages', () => {
  it('should construct a valid CS_GESTURE_EVENT', () => {
    const gesture: GestureEvent = {
      type: 'resize',
      selector: '.hero',
      before_bbox: { x: 0, y: 0, width: 200, height: 40 },
      after_bbox: { x: 0, y: 0, width: 240, height: 48 },
      delta: { resize_right: 40 },
      timestamp: Date.now(),
    };

    const msg: CSGestureMessage = {
      type: 'CS_GESTURE_EVENT',
      payload: {
        gesture,
        scroll_x: 0,
        scroll_y: 100,
        viewport_width: 1280,
        viewport_height: 720,
      },
    };

    expect(msg.type).toBe('CS_GESTURE_EVENT');
    expect(msg.payload.gesture.selector).toBe('.hero');
    expect(msg.payload.viewport_width).toBe(1280);
    expect(getMessageType(msg)).toBe('CS_GESTURE_EVENT');
  });

  it('should construct a valid CS_OVERLAY_READY', () => {
    const msg: CSOverlayReadyMessage = {
      type: 'CS_OVERLAY_READY',
    };
    expect(msg.type).toBe('CS_OVERLAY_READY');
    expect(getMessageType(msg)).toBe('CS_OVERLAY_READY');
  });
});

describe('Message Protocol: Service Worker → Content Script', () => {
  it('should construct SW_ACTIVATE_OVERLAY with mode', () => {
    const msg: SWActivateOverlayMessage = {
      type: 'SW_ACTIVATE_OVERLAY',
      payload: { mode: 'grid' },
    };
    expect(msg.payload.mode).toBe('grid');
  });

  it('should construct SW_DEACTIVATE_OVERLAY', () => {
    const msg: SWDeactivateOverlayMessage = {
      type: 'SW_DEACTIVATE_OVERLAY',
    };
    expect(msg.type).toBe('SW_DEACTIVATE_OVERLAY');
  });
});

describe('Message Protocol: Service Worker → Side Panel', () => {
  it('should construct SW_AGENT_RESPONSE', () => {
    const msg: SWAgentResponseMessage = {
      type: 'SW_AGENT_RESPONSE',
      payload: {
        interpreted_intent: 'Enlarge the hero title by 20%',
        status: 'success',
      },
    };
    expect(msg.payload.status).toBe('success');
    expect(msg.payload.interpreted_intent).toContain('hero');
  });

  it('should construct SW_INTENT_POPULATE', () => {
    const msg: SWIntentPopulateMessage = {
      type: 'SW_INTENT_POPULATE',
      payload: {
        intent_text: 'Enlarge the hero title by 20%',
        gesture: {
          type: 'resize',
          selector: 'h1',
          before_bbox: { x: 0, y: 0, width: 200, height: 40 },
          after_bbox: { x: 0, y: 0, width: 240, height: 48 },
          delta: { resize_right: 40 },
          timestamp: Date.now(),
        },
      },
    };
    expect(msg.payload.intent_text.length).toBeGreaterThan(0);
    expect(msg.payload.gesture.type).toBe('resize');
  });
});

describe('Message Protocol: Side Panel Messages', () => {
  it('should construct SP_ACTIVATE_AGENT', () => {
    const msg: SPActivateAgentMessage = {
      type: 'SP_ACTIVATE_AGENT',
      payload: { mode: 'divbox' },
    };
    expect(msg.payload.mode).toBe('divbox');
  });

  it('should construct SP_SUBMIT_TEXT', () => {
    const msg: SPSubmitTextMessage = {
      type: 'SP_SUBMIT_TEXT',
      payload: { text: 'Make the button larger' },
    };
    expect(msg.payload.text.length).toBeGreaterThan(0);
  });

  it('should construct SP_CONFIRM_PROMPT with prompt and IDE target', () => {
    const prompt: PromptSchema = {
      feature_name: 'Test Feature',
      selector: '.btn',
      action_type: 'resize',
      current_dimensions: { x: 0, y: 0, width: 100, height: 40 },
      target_dimensions: { width: 120 },
      visual_change_description: 'Enlarge button',
      screenshots: [],
      retrieved_examples_used: [],
      tab_url: 'http://localhost:3000',
      scroll_position: { x: 0, y: 0 },
      extension_session_id: 'sess-001',
      prompt_text: 'Resize .btn to 120px wide',
    };

    const msg: SPConfirmPromptMessage = {
      type: 'SP_CONFIRM_PROMPT',
      payload: { prompt, ide_target: 'windsurf' },
    };

    expect(msg.payload.ide_target).toBe('windsurf');
    expect(msg.payload.prompt.feature_name).toBe('Test Feature');
  });

  it('should construct SP_CHECK_CONNECTIVITY', () => {
    const msg: SPCheckConnectivityMessage = {
      type: 'SP_CHECK_CONNECTIVITY',
    };
    expect(msg.type).toBe('SP_CHECK_CONNECTIVITY');
  });
});

describe('Message Type Discriminator', () => {
  it('should correctly identify message types from union', () => {
    const messages: EchoMessage[] = [
      { type: 'CS_OVERLAY_READY' },
      { type: 'SW_DEACTIVATE_OVERLAY' },
      { type: 'SP_CHECK_CONNECTIVITY' },
    ];

    expect(messages.map(getMessageType)).toEqual([
      'CS_OVERLAY_READY',
      'SW_DEACTIVATE_OVERLAY',
      'SP_CHECK_CONNECTIVITY',
    ]);
  });
});
