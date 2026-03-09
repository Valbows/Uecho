/**
 * U:Echo — Background Service Worker
 * Coordinates extension components, manages sessions, routes messages to backend.
 */

import type {
  ContentScriptMessage,
  SidePanelMessage,
} from '@shared/messages';
import type { ConnectivityStatus, EchoSession } from '@shared/types';
import { STORAGE_KEYS, API_ENDPOINTS } from '@shared/constants';

const BACKEND_URL = 'http://localhost:8080';

let currentSession: EchoSession | null = null;

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
  try {
    switch (message.type) {
      // ─── From Content Script ────────────────────────────
      case 'CS_GESTURE_EVENT': {
        const tabId = sender.tab?.id;
        if (!tabId) break;

        // Capture screenshot
        const screenshotUrl = await captureScreenshot(tabId);

        // Forward to backend
        const response = await fetch(
          `${BACKEND_URL}${API_ENDPOINTS.processGesture}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              gesture: message.payload.gesture,
              screenshot_url: screenshotUrl,
              tab_id: tabId,
              page_url: sender.tab?.url || '',
              scroll_x: message.payload.scroll_x,
              scroll_y: message.payload.scroll_y,
              viewport_width: message.payload.viewport_width,
              viewport_height: message.payload.viewport_height,
              extension_session_id: currentSession?.session_id || '',
            }),
          }
        );

        const agentResponse = await response.json();

        // Forward agent response to side panel
        chrome.runtime.sendMessage({
          type: 'SW_AGENT_RESPONSE',
          payload: agentResponse,
        });

        // Auto-populate side panel with intent
        if (agentResponse.interpreted_intent) {
          chrome.runtime.sendMessage({
            type: 'SW_INTENT_POPULATE',
            payload: {
              intent_text: agentResponse.interpreted_intent,
              gesture: message.payload.gesture,
            },
          });
        }

        sendResponse({ ok: true });
        break;
      }

      case 'CS_OVERLAY_READY':
        console.log('[U:Echo SW] Overlay ready');
        sendResponse({ ok: true });
        break;

      // ─── From Side Panel ────────────────────────────────
      case 'SP_ACTIVATE_AGENT': {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (tab?.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'SW_ACTIVATE_OVERLAY',
            payload: { mode: message.payload.mode },
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
        sendResponse({ ok: true });
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
        // TODO: Phase 7 — forward to MCP bridge
        console.log('[U:Echo SW] Prompt confirmed, sending to IDE...');
        sendResponse({ ok: true, sent: false, reason: 'MCP bridge not yet implemented' });
        break;
      }

      default:
        console.warn('[U:Echo SW] Unknown message type:', (message as { type: string }).type);
        sendResponse({ ok: false, error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('[U:Echo SW] Message handler error:', error);
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
    const mcpRes = await fetch('http://localhost:3939/health', {
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

console.log('[U:Echo SW] Service worker loaded');
