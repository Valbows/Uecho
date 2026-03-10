/**
 * U:Echo — Content Script
 * Injected into localhost pages. Manages overlay rendering and gesture capture.
 * Coordinates grid/divbox renderers and emits gesture events to the service worker.
 */

import type { OverlayMode, GestureEvent, BoundingBox, ElementInfo } from '@shared/types';
import type { ServiceWorkerToContentMessage } from '@shared/messages';
import {
  renderGrid,
  destroyGrid,
  renderDivBox,
  destroyDivBox,
  getSelectedElementInfo,
  attachHandles,
  detachHandles,
} from './overlay';

let overlayMode: OverlayMode = 'off';
let overlayContainer: HTMLDivElement | null = null;

// ─── Overlay Container ──────────────────────────────────────────

function ensureOverlayContainer(): HTMLDivElement {
  if (overlayContainer) return overlayContainer;

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
  overlayContainer = container;
  return container;
}

// ─── Activation / Deactivation ──────────────────────────────────

function activateOverlay(mode: OverlayMode): void {
  const container = ensureOverlayContainer();

  // Tear down previous mode
  teardownCurrentMode(container);

  overlayMode = mode;
  container.style.display = 'block';

  if (mode === 'grid') {
    renderGrid(container);
  } else if (mode === 'divbox') {
    renderDivBox(container);
  }

  console.log(`[U:Echo] Overlay activated: ${mode}`);
  chrome.runtime.sendMessage({ type: 'CS_OVERLAY_READY' });
}

function deactivateOverlay(): void {
  if (overlayContainer) {
    teardownCurrentMode(overlayContainer);
    overlayContainer.style.display = 'none';
  }
  overlayMode = 'off';
  console.log('[U:Echo] Overlay deactivated');
}

function teardownCurrentMode(container: HTMLDivElement): void {
  detachHandles();
  if (overlayMode === 'grid') {
    destroyGrid(container);
  } else if (overlayMode === 'divbox') {
    destroyDivBox(container);
  }
}

// ─── Gesture Pipeline ───────────────────────────────────────────

function onGestureCapture(gesture: GestureEvent): void {
  const elementInfo = getSelectedElementInfo();

  chrome.runtime.sendMessage({
    type: 'CS_GESTURE_EVENT',
    payload: {
      gesture,
      scroll_x: window.scrollX,
      scroll_y: window.scrollY,
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      element_info: elementInfo ?? undefined,
    },
  });

  console.log(`[U:Echo] Gesture captured: ${gesture.type} on ${gesture.selector}`);
}

// ─── Custom Event Listeners ─────────────────────────────────────

document.addEventListener('uecho:element-selected', ((
  e: CustomEvent<{ elementInfo: ElementInfo; boundingBox: BoundingBox }>
) => {
  const { elementInfo, boundingBox } = e.detail;
  const container = ensureOverlayContainer();

  // Attach resize/move handles to the selected element
  attachHandles(container, boundingBox, elementInfo.selector, onGestureCapture);
}) as EventListener);

document.addEventListener('uecho:element-deselected', () => {
  detachHandles();
});

document.addEventListener('uecho:grid-selection', ((
  e: CustomEvent<{
    cells: Array<{ col: number; row: number; x: number; y: number; width: number; height: number }>;
    region: BoundingBox;
    cellSize: number;
  }>
) => {
  const { region } = e.detail;
  const container = ensureOverlayContainer();

  // Attach handles to the selected grid region
  const selector = `grid-region[${region.x},${region.y},${region.width}x${region.height}]`;
  attachHandles(container, region, selector, onGestureCapture);
}) as EventListener);

// ─── Message Listener ───────────────────────────────────────────

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
    return true;
  }
);

console.log('[U:Echo] Content script loaded — overlay engine ready');
