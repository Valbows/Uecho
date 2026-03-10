/**
 * U:Echo — Unit Tests: Action Recorder State Machine
 */

import { ActionRecorder } from '../../src/background/recorder';
import type { GestureEvent, AgentResponse } from '../../src/shared/types';

const mockGesture: GestureEvent = {
  type: 'resize',
  selector: '.hero-title',
  before_bbox: { x: 10, y: 20, width: 200, height: 40 },
  after_bbox: { x: 10, y: 20, width: 240, height: 48 },
  delta: { resize_right: 40, resize_bottom: 8 },
  timestamp: Date.now(),
};

const mockAgentResponse: AgentResponse = {
  interpreted_intent: 'Resize .hero-title from 200x40 to 240x48',
  status: 'success',
};

describe('ActionRecorder: State Transitions', () => {
  it('should start in idle state', () => {
    const recorder = new ActionRecorder('session-1');
    expect(recorder.getState()).toBe('idle');
  });

  it('should transition to recording on START_RECORDING', () => {
    const recorder = new ActionRecorder('session-1');
    recorder.dispatch({ type: 'START_RECORDING', tabId: 1, pageUrl: 'http://localhost:3000' });
    expect(recorder.getState()).toBe('recording');
  });

  it('should transition to captured on GESTURE_CAPTURED', () => {
    const recorder = new ActionRecorder('session-1');
    recorder.dispatch({ type: 'START_RECORDING', tabId: 1, pageUrl: 'http://localhost:3000' });
    recorder.dispatch({
      type: 'GESTURE_CAPTURED',
      gesture: mockGesture,
      scrollX: 0,
      scrollY: 0,
      viewportWidth: 1280,
      viewportHeight: 720,
    });
    expect(recorder.getState()).toBe('captured');
  });

  it('should ignore GESTURE_CAPTURED when not recording', () => {
    const recorder = new ActionRecorder('session-1');
    recorder.dispatch({
      type: 'GESTURE_CAPTURED',
      gesture: mockGesture,
      scrollX: 0,
      scrollY: 0,
      viewportWidth: 1280,
      viewportHeight: 720,
    });
    expect(recorder.getState()).toBe('idle');
  });

  it('should transition to processing on PROCESSING_START', () => {
    const recorder = new ActionRecorder('session-1');
    recorder.dispatch({ type: 'START_RECORDING', tabId: 1, pageUrl: 'http://localhost:3000' });
    recorder.dispatch({
      type: 'GESTURE_CAPTURED',
      gesture: mockGesture,
      scrollX: 0,
      scrollY: 100,
      viewportWidth: 1280,
      viewportHeight: 720,
    });
    recorder.dispatch({ type: 'PROCESSING_START' });
    expect(recorder.getState()).toBe('processing');
  });

  it('should transition to complete on AGENT_RESPONSE', () => {
    const recorder = new ActionRecorder('session-1');
    recorder.dispatch({ type: 'START_RECORDING', tabId: 1, pageUrl: 'http://localhost:3000' });
    recorder.dispatch({
      type: 'GESTURE_CAPTURED',
      gesture: mockGesture,
      scrollX: 0,
      scrollY: 0,
      viewportWidth: 1280,
      viewportHeight: 720,
    });
    recorder.dispatch({ type: 'PROCESSING_START' });
    recorder.dispatch({ type: 'AGENT_RESPONSE', response: mockAgentResponse });
    expect(recorder.getState()).toBe('complete');
  });

  it('should transition to error on ERROR', () => {
    const recorder = new ActionRecorder('session-1');
    recorder.dispatch({ type: 'START_RECORDING', tabId: 1, pageUrl: 'http://localhost:3000' });
    recorder.dispatch({
      type: 'GESTURE_CAPTURED',
      gesture: mockGesture,
      scrollX: 0,
      scrollY: 0,
      viewportWidth: 1280,
      viewportHeight: 720,
    });
    recorder.dispatch({ type: 'PROCESSING_START' });
    recorder.dispatch({ type: 'ERROR', message: 'Backend timeout' });
    expect(recorder.getState()).toBe('error');
    expect(recorder.getContext().errorMessage).toBe('Backend timeout');
  });

  it('should reset to idle on RESET', () => {
    const recorder = new ActionRecorder('session-1');
    recorder.dispatch({ type: 'START_RECORDING', tabId: 1, pageUrl: 'http://localhost:3000' });
    recorder.dispatch({ type: 'RESET' });
    expect(recorder.getState()).toBe('idle');
    expect(recorder.getContext().activeGesture).toBeNull();
  });
});

describe('ActionRecorder: Metadata Assembly', () => {
  it('should assemble metadata from gesture event', () => {
    const recorder = new ActionRecorder('session-42');
    recorder.dispatch({ type: 'START_RECORDING', tabId: 5, pageUrl: 'http://localhost:3000/app' });
    recorder.dispatch({
      type: 'GESTURE_CAPTURED',
      gesture: mockGesture,
      scrollX: 10,
      scrollY: 200,
      viewportWidth: 1920,
      viewportHeight: 1080,
    });

    const ctx = recorder.getContext();
    expect(ctx.metadata).not.toBeNull();
    expect(ctx.metadata!.gesture).toEqual(mockGesture);
    expect(ctx.metadata!.tab_id).toBe(5);
    expect(ctx.metadata!.page_url).toBe('http://localhost:3000/app');
    expect(ctx.metadata!.scroll_x).toBe(10);
    expect(ctx.metadata!.scroll_y).toBe(200);
    expect(ctx.metadata!.viewport_width).toBe(1920);
    expect(ctx.metadata!.viewport_height).toBe(1080);
    expect(ctx.metadata!.extension_session_id).toBe('session-42');
  });

  it('should update screenshot_url on SCREENSHOT_READY', () => {
    const recorder = new ActionRecorder('session-1');
    recorder.dispatch({ type: 'START_RECORDING', tabId: 1, pageUrl: 'http://localhost:3000' });
    recorder.dispatch({
      type: 'GESTURE_CAPTURED',
      gesture: mockGesture,
      scrollX: 0,
      scrollY: 0,
      viewportWidth: 1280,
      viewportHeight: 720,
    });
    recorder.dispatch({ type: 'SCREENSHOT_READY', screenshotUrl: 'data:image/png;base64,abc123' });

    const ctx = recorder.getContext();
    expect(ctx.screenshotUrl).toBe('data:image/png;base64,abc123');
    expect(ctx.metadata!.screenshot_url).toBe('data:image/png;base64,abc123');
  });
});

describe('ActionRecorder: Request Record', () => {
  it('should create request record on PROCESSING_START', () => {
    const recorder = new ActionRecorder('session-1');
    recorder.dispatch({ type: 'START_RECORDING', tabId: 1, pageUrl: 'http://localhost:3000' });
    recorder.dispatch({
      type: 'GESTURE_CAPTURED',
      gesture: mockGesture,
      scrollX: 0,
      scrollY: 0,
      viewportWidth: 1280,
      viewportHeight: 720,
    });
    recorder.dispatch({ type: 'PROCESSING_START' });

    const record = recorder.getContext().requestRecord;
    expect(record).not.toBeNull();
    expect(record!.session_id).toBe('session-1');
    expect(record!.action_type).toBe('resize');
    expect(record!.selector).toBe('.hero-title');
    expect(record!.status).toBe('processing');
  });

  it('should update request record on AGENT_RESPONSE with success', () => {
    const recorder = new ActionRecorder('session-1');
    recorder.dispatch({ type: 'START_RECORDING', tabId: 1, pageUrl: 'http://localhost:3000' });
    recorder.dispatch({
      type: 'GESTURE_CAPTURED',
      gesture: mockGesture,
      scrollX: 0,
      scrollY: 0,
      viewportWidth: 1280,
      viewportHeight: 720,
    });
    recorder.dispatch({ type: 'PROCESSING_START' });
    recorder.dispatch({ type: 'AGENT_RESPONSE', response: mockAgentResponse });

    const record = recorder.getContext().requestRecord;
    expect(record!.status).toBe('verified');
    expect(record!.interpreted_intent).toBe('Resize .hero-title from 200x40 to 240x48');
  });

  it('should mark request record as failed on ERROR', () => {
    const recorder = new ActionRecorder('session-1');
    recorder.dispatch({ type: 'START_RECORDING', tabId: 1, pageUrl: 'http://localhost:3000' });
    recorder.dispatch({
      type: 'GESTURE_CAPTURED',
      gesture: mockGesture,
      scrollX: 0,
      scrollY: 0,
      viewportWidth: 1280,
      viewportHeight: 720,
    });
    recorder.dispatch({ type: 'PROCESSING_START' });
    recorder.dispatch({ type: 'ERROR', message: 'Network error' });

    const record = recorder.getContext().requestRecord;
    expect(record!.status).toBe('failed');
  });
});

describe('ActionRecorder: State Change Listener', () => {
  it('should notify listeners on state change', () => {
    const recorder = new ActionRecorder('session-1');
    const states: string[] = [];
    recorder.onStateChange((ctx) => states.push(ctx.state));

    recorder.dispatch({ type: 'START_RECORDING', tabId: 1, pageUrl: 'http://localhost:3000' });
    recorder.dispatch({
      type: 'GESTURE_CAPTURED',
      gesture: mockGesture,
      scrollX: 0,
      scrollY: 0,
      viewportWidth: 1280,
      viewportHeight: 720,
    });

    expect(states).toEqual(['recording', 'captured']);
  });

  it('should allow unsubscribing from state changes', () => {
    const recorder = new ActionRecorder('session-1');
    const states: string[] = [];
    const unsub = recorder.onStateChange((ctx) => states.push(ctx.state));

    recorder.dispatch({ type: 'START_RECORDING', tabId: 1, pageUrl: 'http://localhost:3000' });
    unsub();
    recorder.dispatch({
      type: 'GESTURE_CAPTURED',
      gesture: mockGesture,
      scrollX: 0,
      scrollY: 0,
      viewportWidth: 1280,
      viewportHeight: 720,
    });

    expect(states).toEqual(['recording']);
  });
});
