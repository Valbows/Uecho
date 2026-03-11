/**
 * U:Echo — Background Service Worker
 * Coordinates extension components, manages sessions, routes messages to backend.
 * Uses ActionRecorder state machine, RequestQueue, and SessionManager.
 */

import type {
  ContentScriptMessage,
  SidePanelMessage,
} from '@shared/messages';
import type { ConnectivityStatus, ElementInfo } from '@shared/types';
import { STORAGE_KEYS, API_ENDPOINTS } from '@shared/constants';
import { ActionRecorder } from './recorder';
import { RequestQueue } from './request-queue';
import { SessionManager } from './session-manager';
import {
  validateMessage,
  validateSubmitText,
  validateConfirmPrompt,
  validateActivateAgent,
  sanitizeString,
} from './message-validator';

const BACKEND_URL = 'http://localhost:8000';
const MCP_BRIDGE_URL = 'http://localhost:3939';

// ─── Module Instances ───────────────────────────────────────────
const sessionManager = new SessionManager();
const recorders = new Map<number, ActionRecorder>();
const requestQueue = new RequestQueue(BACKEND_URL);

// Wire queue completion → recorder + side panel
requestQueue.setUpdateCallback((request) => {
  const tabRecorder = recorders.get(request.metadata.tab_id);
  if (request.status === 'completed' && request.response) {
    tabRecorder?.dispatch({ type: 'AGENT_RESPONSE', response: request.response });

    chrome.runtime.sendMessage({
      type: 'SW_AGENT_RESPONSE',
      payload: request.response,
    });

    if (request.response.interpreted_intent) {
      chrome.runtime.sendMessage({
        type: 'SW_INTENT_POPULATE',
        payload: {
          intent_text: request.response.interpreted_intent,
          gesture: request.metadata.gesture,
        },
      });
    }
  } else if (request.status === 'failed') {
    tabRecorder?.dispatch({ type: 'ERROR', message: request.error || 'Unknown error' });
  }
});

// ─── Side Panel Behavior ────────────────────────────────────────
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('[U:Echo SW] Side panel error:', error));

// ─── Message Router ─────────────────────────────────────────────
chrome.runtime.onMessage.addListener(
  (
    message: ContentScriptMessage | SidePanelMessage,
    sender,
    sendResponse
  ) => {
    handleMessage(message, sender, sendResponse);
    return true; // async
  }
);

async function handleMessage(
  message: ContentScriptMessage | SidePanelMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void
): Promise<void> {
  // Runtime message validation
  const validation = validateMessage(message, sender);
  if (!validation.valid) {
    console.warn('[U:Echo SW] Message rejected:', validation.error);
    sendResponse({ ok: false, error: validation.error });
    return;
  }

  try {
    switch (message.type) {
      // ─── From Content Script ────────────────────────────
      case 'CS_GESTURE_EVENT': {
        const tabId = sender.tab?.id;
        const pageUrl = sender.tab?.url || '';
        if (!tabId) break;

        // Ensure per-tab session + recorder
        const session = await sessionManager.getOrCreate(pageUrl);
        let recorder = recorders.get(tabId);
        if (!recorder) {
          recorder = new ActionRecorder(session.session_id);
          recorders.set(tabId, recorder);
          recorder.dispatch({ type: 'START_RECORDING', tabId, pageUrl });
        }

        // Dispatch gesture into recorder
        recorder.dispatch({
          type: 'GESTURE_CAPTURED',
          gesture: message.payload.gesture,
          scrollX: message.payload.scroll_x,
          scrollY: message.payload.scroll_y,
          viewportWidth: message.payload.viewport_width,
          viewportHeight: message.payload.viewport_height,
          elementInfo: (message.payload as { element_info?: ElementInfo }).element_info,
        });

        // Capture screenshot — fail loudly if empty
        const screenshotUrl = await captureScreenshot(tabId);
        if (!screenshotUrl) {
          recorder.dispatch({ type: 'ERROR', message: 'Screenshot capture returned empty' });
          sendResponse({ ok: false, error: 'Screenshot capture failed', state: recorder.getState() });
          break;
        }
        recorder.dispatch({ type: 'SCREENSHOT_READY', screenshotUrl });

        // Validate metadata before enqueuing
        const metadata = recorder.getContext().metadata;
        if (!metadata) {
          recorder.dispatch({ type: 'ERROR', message: 'Metadata assembly failed after gesture capture' });
          sendResponse({ ok: false, error: 'Metadata assembly failed', state: recorder.getState() });
          break;
        }

        recorder.dispatch({ type: 'PROCESSING_START' });
        requestQueue.enqueue(metadata);

        sendResponse({ ok: true, state: recorder.getState() });
        break;
      }

      case 'CS_OVERLAY_READY':
        console.log('[U:Echo SW] Overlay ready');
        sendResponse({ ok: true });
        break;

      // ─── From Side Panel ────────────────────────────────
      case 'SP_ACTIVATE_AGENT': {
        const activateCheck = validateActivateAgent(message.payload);
        if (!activateCheck.valid) {
          sendResponse({ ok: false, error: activateCheck.error });
          break;
        }
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (tab?.id) {
          const session = await sessionManager.getOrCreate(tab.url || '');
          await sessionManager.updateMode(message.payload.mode);
          await sessionManager.setAgentActive(true);

          const tabRecorder = new ActionRecorder(session.session_id);
          recorders.set(tab.id, tabRecorder);
          tabRecorder.dispatch({
            type: 'START_RECORDING',
            tabId: tab.id,
            pageUrl: tab.url || '',
          });

          chrome.tabs.sendMessage(tab.id, {
            type: 'SW_ACTIVATE_OVERLAY',
            payload: { mode: message.payload.mode },
          });

          chrome.runtime.sendMessage({
            type: 'SW_SESSION_UPDATE',
            payload: session,
          });
        }
        sendResponse({ ok: true });
        break;
      }

      case 'SP_DEACTIVATE_AGENT': {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (tab?.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'SW_DEACTIVATE_OVERLAY',
          });
        }
        await sessionManager.updateMode('off');
        await sessionManager.setAgentActive(false);
        if (tab?.id) {
          recorders.get(tab.id)?.dispatch({ type: 'RESET' });
          recorders.delete(tab.id);
        }
        sendResponse({ ok: true });
        break;
      }

      case 'SP_SUBMIT_TEXT': {
        const submitCheck = validateSubmitText(message.payload);
        if (!submitCheck.valid) {
          sendResponse({ ok: false, error: submitCheck.error });
          break;
        }
        // Forward text to enhance endpoint
        try {
          const enhanceRes = await fetch(
            `${BACKEND_URL}${API_ENDPOINTS.enhanceText}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: sanitizeString(message.payload.text),
                metadata: message.payload.metadata || {},
              }),
            }
          );
          if (!enhanceRes.ok) {
            const errorBody = await enhanceRes.text();
            sendResponse({ ok: false, status: enhanceRes.status, error: errorBody });
            break;
          }
          const enhanced = await enhanceRes.json();
          sendResponse({ ok: true, ...enhanced });
        } catch (error) {
          sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
        }
        break;
      }

      case 'SP_CHECK_CONNECTIVITY': {
        const status = await checkConnectivity();
        chrome.runtime.sendMessage({
          type: 'SW_CONNECTIVITY_UPDATE',
          payload: status,
        });
        sendResponse(status);
        break;
      }

      case 'SP_CONFIRM_PROMPT': {
        const confirmCheck = validateConfirmPrompt(message.payload);
        if (!confirmCheck.valid) {
          sendResponse({ ok: false, error: confirmCheck.error });
          break;
        }
        // Forward to MCP bridge
        try {
          const mcpRes = await fetch(`${MCP_BRIDGE_URL}/prompt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt_text: message.payload.prompt.prompt_text,
              feature_name: message.payload.prompt.feature_name,
              selector: message.payload.prompt.selector,
              action_type: message.payload.prompt.action_type,
              ide_target: message.payload.ide_target,
              metadata: {
                session_id: sessionManager.getCurrent()?.session_id,
              },
            }),
          });
          const result = await mcpRes.json();
          sendResponse({ ok: true, ...result });
        } catch (error) {
          sendResponse({ ok: false, error: String(error) });
        }
        break;
      }

      case 'SP_UPDATE_SETTINGS': {
        const current = await chrome.storage.local.get(STORAGE_KEYS.settings);
        const merged = { ...current[STORAGE_KEYS.settings], ...message.payload };
        await chrome.storage.local.set({ [STORAGE_KEYS.settings]: merged });

        // If overlay mode changed, update session and content script
        if (message.payload.overlay_mode) {
          await sessionManager.updateMode(message.payload.overlay_mode);
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.id) {
            chrome.tabs.sendMessage(tab.id, {
              type: 'SW_UPDATE_OVERLAY_MODE',
              payload: { mode: message.payload.overlay_mode },
            });
          }
        }
        sendResponse({ ok: true });
        break;
      }

      case 'SP_EXPORT_CSV': {
        try {
          const sid = message.payload.session_id;
          const exportRes = await fetch(
            `${BACKEND_URL}${API_ENDPOINTS.exportCsv}${sid ? `?session_id=${encodeURIComponent(sid)}` : ''}`,
            { method: 'GET' }
          );
          if (!exportRes.ok) {
            const errorBody = await exportRes.text();
            sendResponse({ ok: false, status: exportRes.status, error: errorBody });
            break;
          }
          const exportData = await exportRes.json();
          sendResponse({ ok: true, ...exportData });
        } catch (error) {
          sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
        }
        break;
      }

      default:
        console.warn('[U:Echo SW] Unknown message type:', (message as { type: string }).type);
        sendResponse({ ok: false, error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('[U:Echo SW] Message handler error:', error);
    const errorTabId = sender.tab?.id;
    if (errorTabId) {
      recorders.get(errorTabId)?.dispatch({ type: 'ERROR', message: String(error) });
    }
    sendResponse({ ok: false, error: String(error) });
  }
}

// ─── Screenshot Capture ─────────────────────────────────────────
async function captureScreenshot(_tabId: number): Promise<string> {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab({
      format: 'png',
      quality: 90,
    });
    // TODO: Phase 5 — upload to Cloud Storage, return URL
    return dataUrl || '';
  } catch (error) {
    console.error('[U:Echo SW] Screenshot capture failed:', error);
    return '';
  }
}

// ─── Connectivity Check ─────────────────────────────────────────
async function checkConnectivity(): Promise<ConnectivityStatus> {
  const status: ConnectivityStatus = {
    extension: true,
    backend: false,
    ide_bridge: false,
  };

  try {
    const backendRes = await fetch(`${BACKEND_URL}${API_ENDPOINTS.health}`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    status.backend = backendRes.ok;
  } catch {
    status.backend = false;
  }

  try {
    const mcpRes = await fetch(`${MCP_BRIDGE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    status.ide_bridge = mcpRes.ok;
  } catch {
    status.ide_bridge = false;
  }

  return status;
}

// ─── Installation Handler ───────────────────────────────────────
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[U:Echo SW] Extension installed');
    chrome.storage.local.set({
      [STORAGE_KEYS.onboarding_complete]: false,
      [STORAGE_KEYS.settings]: {
        grid_cell_size: 25,
        overlay_mode: 'off',
        ide_target: 'windsurf',
      },
    });
  }
});

// ─── Tab Cleanup ────────────────────────────────────────────────
chrome.tabs.onRemoved.addListener((tabId) => {
  recorders.delete(tabId);
});

console.log('[U:Echo SW] Service worker loaded');
