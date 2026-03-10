/**
 * U:Echo — Action Recorder State Machine
 * Manages the lifecycle of a gesture recording: idle → recording → captured → processing → complete/error
 * Emits state transitions to the side panel and orchestrates the metadata assembly pipeline.
 */

import type {
  GestureEvent,
  MetadataPayload,
  RequestRecord,
  ElementInfo,
  AgentResponse,
} from '@shared/types';

// ─── Recorder States ────────────────────────────────────────────

export type RecorderState =
  | 'idle'
  | 'recording'
  | 'captured'
  | 'processing'
  | 'complete'
  | 'error';

export interface RecorderContext {
  state: RecorderState;
  activeGesture: GestureEvent | null;
  metadata: MetadataPayload | null;
  screenshotUrl: string;
  agentResponse: AgentResponse | null;
  requestRecord: RequestRecord | null;
  errorMessage: string;
  tabId: number | null;
  pageUrl: string;
}

export type RecorderEvent =
  | { type: 'START_RECORDING'; tabId: number; pageUrl: string }
  | { type: 'GESTURE_CAPTURED'; gesture: GestureEvent; scrollX: number; scrollY: number; viewportWidth: number; viewportHeight: number; elementInfo?: ElementInfo }
  | { type: 'SCREENSHOT_READY'; screenshotUrl: string }
  | { type: 'PROCESSING_START' }
  | { type: 'AGENT_RESPONSE'; response: AgentResponse }
  | { type: 'ERROR'; message: string }
  | { type: 'RESET' };

export type StateChangeCallback = (ctx: RecorderContext) => void;

// ─── Recorder Class ─────────────────────────────────────────────

export class ActionRecorder {
  private ctx: RecorderContext;
  private listeners: StateChangeCallback[] = [];
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.ctx = this.createInitialContext();
  }

  getState(): RecorderState {
    return this.ctx.state;
  }

  getContext(): Readonly<RecorderContext> {
    return { ...this.ctx };
  }

  onStateChange(cb: StateChangeCallback): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  dispatch(event: RecorderEvent): void {
    const prevState = this.ctx.state;

    switch (event.type) {
      case 'START_RECORDING':
        this.ctx = this.createInitialContext();
        this.ctx.tabId = event.tabId;
        this.ctx.pageUrl = event.pageUrl;
        this.transitionTo('recording');
        break;

      case 'GESTURE_CAPTURED':
        if (this.ctx.state !== 'recording') return;
        this.ctx.activeGesture = event.gesture;
        this.ctx.metadata = this.assembleMetadata(event);
        this.transitionTo('captured');
        break;

      case 'SCREENSHOT_READY':
        if (this.ctx.state !== 'captured') return;
        this.ctx.screenshotUrl = event.screenshotUrl;
        if (this.ctx.metadata) {
          this.ctx.metadata.screenshot_url = event.screenshotUrl;
        }
        break;

      case 'PROCESSING_START':
        if (this.ctx.state !== 'captured') return;
        this.ctx.requestRecord = this.createRequestRecord();
        this.transitionTo('processing');
        break;

      case 'AGENT_RESPONSE':
        if (this.ctx.state !== 'processing') return;
        this.ctx.agentResponse = event.response;
        if (this.ctx.requestRecord) {
          this.ctx.requestRecord.interpreted_intent = event.response.interpreted_intent;
          this.ctx.requestRecord.prompt = event.response.prompt;
          this.ctx.requestRecord.verification = event.response.verification;
          this.ctx.requestRecord.status =
            event.response.status === 'success' ? 'verified' : 'failed';
          this.ctx.requestRecord.updated_at = Date.now();
        }
        this.transitionTo('complete');
        break;

      case 'ERROR':
        this.ctx.errorMessage = event.message;
        if (this.ctx.requestRecord) {
          this.ctx.requestRecord.status = 'failed';
          this.ctx.requestRecord.updated_at = Date.now();
        }
        this.transitionTo('error');
        break;

      case 'RESET':
        this.ctx = this.createInitialContext();
        break;
    }

    if (this.ctx.state !== prevState || event.type === 'RESET') {
      this.notifyListeners();
    }
  }

  // ─── Metadata Assembly ──────────────────────────────────────

  private assembleMetadata(event: Extract<RecorderEvent, { type: 'GESTURE_CAPTURED' }>): MetadataPayload {
    return {
      gesture: event.gesture,
      screenshot_url: this.ctx.screenshotUrl,
      tab_id: this.ctx.tabId ?? -1,
      page_url: this.ctx.pageUrl,
      scroll_x: event.scrollX,
      scroll_y: event.scrollY,
      viewport_width: event.viewportWidth,
      viewport_height: event.viewportHeight,
      extension_session_id: this.sessionId,
      element_info: event.elementInfo,
    };
  }

  private createRequestRecord(): RequestRecord {
    const gesture = this.ctx.activeGesture!;
    return {
      request_id: crypto.randomUUID(),
      session_id: this.sessionId,
      action_type: gesture.type,
      selector: gesture.selector,
      interpreted_intent: '',
      screenshot_url: this.ctx.screenshotUrl || undefined,
      status: 'processing',
      created_at: Date.now(),
      updated_at: Date.now(),
    };
  }

  private createInitialContext(): RecorderContext {
    return {
      state: 'idle',
      activeGesture: null,
      metadata: null,
      screenshotUrl: '',
      agentResponse: null,
      requestRecord: null,
      errorMessage: '',
      tabId: null,
      pageUrl: '',
    };
  }

  private transitionTo(state: RecorderState): void {
    this.ctx.state = state;
  }

  private notifyListeners(): void {
    const snapshot = { ...this.ctx };
    this.listeners.forEach((cb) => cb(snapshot));
  }
}
