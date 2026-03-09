/**
 * U:Echo — Content Script
 * Injected into localhost pages. Manages overlay rendering and gesture capture.
 */

import type { OverlayMode } from '@shared/types';
import type {
  SWActivateOverlayMessage,
  SWDeactivateOverlayMessage,
  SWUpdateOverlayModeMessage,
  ServiceWorkerToContentMessage,
} from '@shared/messages';

let overlayMode: OverlayMode = 'off';
let overlayContainer: HTMLDivElement | null = null;

function createOverlayContainer(): HTMLDivElement {
  const container = document.createElement('div');
  container.id = 'uecho-overlay-root';
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 2147483646;
  `;
  document.body.appendChild(container);
  return container;
}

function activateOverlay(mode: OverlayMode): void {
  if (!overlayContainer) {
    overlayContainer = createOverlayContainer();
  }
  overlayMode = mode;
  overlayContainer.style.display = 'block';
  // TODO: Phase 3 — render grid or div-box overlay based on mode
  console.log(`[U:Echo] Overlay activated: ${mode}`);
  chrome.runtime.sendMessage({ type: 'CS_OVERLAY_READY' });
}

function deactivateOverlay(): void {
  overlayMode = 'off';
  if (overlayContainer) {
    overlayContainer.style.display = 'none';
    overlayContainer.innerHTML = '';
  }
  console.log('[U:Echo] Overlay deactivated');
}

// Listen for messages from service worker
chrome.runtime.onMessage.addListener(
  (message: ServiceWorkerToContentMessage, _sender, sendResponse) => {
    switch (message.type) {
      case 'SW_ACTIVATE_OVERLAY':
        activateOverlay(message.payload.mode);
        sendResponse({ ok: true });
        break;
      case 'SW_DEACTIVATE_OVERLAY':
        deactivateOverlay();
        sendResponse({ ok: true });
        break;
      case 'SW_UPDATE_OVERLAY_MODE':
        activateOverlay(message.payload.mode);
        sendResponse({ ok: true });
        break;
      default:
        break;
    }
    return true; // async response
  }
);

console.log('[U:Echo] Content script loaded');
