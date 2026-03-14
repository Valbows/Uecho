/**
 * U:Echo — Chrome Extension Message Protocol
 * Defines all message types between content script ↔ service worker ↔ side panel
 */

import type {
  GestureEvent,
  MetadataPayload,
  OverlayMode,
  AgentResponse,
  PromptSchema,
  ElementInfo,
  ConnectivityStatus,
  EchoSession,
  UserSettings,
} from './types';

// ─── Message Direction Tags ─────────────────────────────────────
// CS = Content Script, SW = Service Worker (Background), SP = Side Panel

// ─── Content Script → Service Worker ────────────────────────────
export interface CSGestureMessage {
  type: 'CS_GESTURE_EVENT';
  payload: {
    gesture: GestureEvent;
    scroll_x: number;
    scroll_y: number;
    viewport_width: number;
    viewport_height: number;
  };
}

export interface CSElementHoverMessage {
  type: 'CS_ELEMENT_HOVER';
  payload: ElementInfo;
}

export interface CSOverlayReadyMessage {
  type: 'CS_OVERLAY_READY';
}

// ─── Service Worker → Content Script ────────────────────────────
export interface SWActivateOverlayMessage {
  type: 'SW_ACTIVATE_OVERLAY';
  payload: { mode: OverlayMode };
}

export interface SWDeactivateOverlayMessage {
  type: 'SW_DEACTIVATE_OVERLAY';
}

export interface SWUpdateOverlayModeMessage {
  type: 'SW_UPDATE_OVERLAY_MODE';
  payload: { mode: OverlayMode };
}

// ─── Service Worker → Side Panel ────────────────────────────────
export interface SWAgentResponseMessage {
  type: 'SW_AGENT_RESPONSE';
  payload: AgentResponse;
}

export interface SWIntentPopulateMessage {
  type: 'SW_INTENT_POPULATE';
  payload: { intent_text: string; gesture: GestureEvent };
}

export interface SWScreenshotCapturedMessage {
  type: 'SW_SCREENSHOT_CAPTURED';
  payload: { screenshot_url: string };
}

export interface SWSessionUpdateMessage {
  type: 'SW_SESSION_UPDATE';
  payload: EchoSession;
}

export interface SWConnectivityUpdateMessage {
  type: 'SW_CONNECTIVITY_UPDATE';
  payload: ConnectivityStatus;
}

// ─── Side Panel → Service Worker ────────────────────────────────
export interface SPActivateAgentMessage {
  type: 'SP_ACTIVATE_AGENT';
  payload: { mode: OverlayMode };
}

export interface SPDeactivateAgentMessage {
  type: 'SP_DEACTIVATE_AGENT';
}

export interface SPSubmitTextMessage {
  type: 'SP_SUBMIT_TEXT';
  payload: { text: string; metadata?: Partial<MetadataPayload> };
}

export interface SPEnhanceTextMessage {
  type: 'SP_ENHANCE_TEXT';
  payload: { text: string; metadata?: Partial<MetadataPayload> };
}

export interface SPConfirmPromptMessage {
  type: 'SP_CONFIRM_PROMPT';
  payload: { prompt: PromptSchema; ide_target: string };
}

export interface SPUpdateSettingsMessage {
  type: 'SP_UPDATE_SETTINGS';
  payload: Partial<UserSettings>;
}

export interface SPCheckConnectivityMessage {
  type: 'SP_CHECK_CONNECTIVITY';
}

export interface SPExportCSVMessage {
  type: 'SP_EXPORT_CSV';
  payload: { session_id?: string };
}

export interface SPVoiceStartMessage {
  type: 'SP_VOICE_START';
  payload: { lang?: string; interimResults?: boolean };
}

export interface SPVoiceStopMessage {
  type: 'SP_VOICE_STOP';
}

export interface SPVoiceCheckSupportMessage {
  type: 'SP_VOICE_CHECK_SUPPORT';
}

// ─── Offscreen → Service Worker Messages ────────────────────────
export interface VoiceStatusMessage {
  type: 'VOICE_STATUS';
  status: 'listening' | 'idle' | 'error';
  error?: string;
}

export interface VoiceTranscriptMessage {
  type: 'VOICE_TRANSCRIPT';
  text: string;
  isFinal: boolean;
}

export type OffscreenMessage = VoiceStatusMessage | VoiceTranscriptMessage;

// ─── Union Types ────────────────────────────────────────────────
export type ContentScriptMessage =
  | CSGestureMessage
  | CSElementHoverMessage
  | CSOverlayReadyMessage;

export type ServiceWorkerToContentMessage =
  | SWActivateOverlayMessage
  | SWDeactivateOverlayMessage
  | SWUpdateOverlayModeMessage;

export type ServiceWorkerToSidePanelMessage =
  | SWAgentResponseMessage
  | SWIntentPopulateMessage
  | SWScreenshotCapturedMessage
  | SWSessionUpdateMessage
  | SWConnectivityUpdateMessage;

export type SidePanelMessage =
  | SPActivateAgentMessage
  | SPDeactivateAgentMessage
  | SPSubmitTextMessage
  | SPEnhanceTextMessage
  | SPConfirmPromptMessage
  | SPUpdateSettingsMessage
  | SPCheckConnectivityMessage
  | SPExportCSVMessage
  | SPVoiceStartMessage
  | SPVoiceStopMessage
  | SPVoiceCheckSupportMessage;

export type EchoMessage =
  | ContentScriptMessage
  | ServiceWorkerToContentMessage
  | ServiceWorkerToSidePanelMessage
  | SidePanelMessage
  | OffscreenMessage;
