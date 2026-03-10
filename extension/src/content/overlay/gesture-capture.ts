/**
 * U:Echo — Gesture Capture Engine
 * Attaches resize/move handles to a selected element and captures
 * drag gestures as GestureEvent objects for the agent pipeline.
 */

import type { BoundingBox, GestureEvent, GestureDelta, ActionType } from '@shared/types';

export type GestureCallback = (gesture: GestureEvent) => void;

interface HandleConfig {
  position: string;
  cursor: string;
  xFactor: number;
  yFactor: number;
}

const HANDLE_POSITIONS: HandleConfig[] = [
  { position: 'nw', cursor: 'nwse-resize', xFactor: -1, yFactor: -1 },
  { position: 'n',  cursor: 'ns-resize',   xFactor: 0,  yFactor: -1 },
  { position: 'ne', cursor: 'nesw-resize', xFactor: 1,  yFactor: -1 },
  { position: 'w',  cursor: 'ew-resize',   xFactor: -1, yFactor: 0 },
  { position: 'e',  cursor: 'ew-resize',   xFactor: 1,  yFactor: 0 },
  { position: 'sw', cursor: 'nesw-resize', xFactor: -1, yFactor: 1 },
  { position: 's',  cursor: 'ns-resize',   xFactor: 0,  yFactor: 1 },
  { position: 'se', cursor: 'nwse-resize', xFactor: 1,  yFactor: 1 },
];

let handlesContainer: HTMLDivElement | null = null;
let moveHandle: HTMLDivElement | null = null;
let onGesture: GestureCallback | null = null;
let currentSelector = '';
let beforeBbox: BoundingBox = { x: 0, y: 0, width: 0, height: 0 };
let activeDragCleanup: (() => void) | null = null;

export function attachHandles(
  container: HTMLDivElement,
  bbox: BoundingBox,
  selector: string,
  callback: GestureCallback
): void {
  detachHandles();
  onGesture = callback;
  currentSelector = selector;
  beforeBbox = { ...bbox };

  handlesContainer = document.createElement('div');
  handlesContainer.className = 'uecho-handles-container';
  handlesContainer.style.cssText = `
    position: absolute;
    left: ${bbox.x - window.scrollX}px;
    top: ${bbox.y - window.scrollY}px;
    width: ${bbox.width}px;
    height: ${bbox.height}px;
    pointer-events: none;
  `;

  // Resize handles
  HANDLE_POSITIONS.forEach((cfg) => {
    const handle = createHandle(cfg);
    handlesContainer!.appendChild(handle);
  });

  // Move handle (center area)
  moveHandle = document.createElement('div');
  moveHandle.className = 'uecho-move-handle';
  moveHandle.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: all;
    cursor: move;
    z-index: 2147483646;
  `;
  moveHandle.addEventListener('mousedown', handleMoveStart);
  handlesContainer.appendChild(moveHandle);

  container.appendChild(handlesContainer);
}

export function detachHandles(): void {
  if (activeDragCleanup) {
    activeDragCleanup();
    activeDragCleanup = null;
  }
  if (handlesContainer) {
    handlesContainer.remove();
    handlesContainer = null;
  }
  moveHandle = null;
  onGesture = null;
}

export function updateHandlesPosition(bbox: BoundingBox): void {
  if (!handlesContainer) return;
  handlesContainer.style.left = `${bbox.x - window.scrollX}px`;
  handlesContainer.style.top = `${bbox.y - window.scrollY}px`;
  handlesContainer.style.width = `${bbox.width}px`;
  handlesContainer.style.height = `${bbox.height}px`;
}

// ─── Internal ───────────────────────────────────────────────────

function createHandle(cfg: HandleConfig): HTMLDivElement {
  const handle = document.createElement('div');
  handle.className = `uecho-resize-handle uecho-handle-${cfg.position}`;
  handle.dataset.position = cfg.position;

  const pos = getHandlePosition(cfg.position);
  handle.style.cssText = `
    position: absolute;
    width: 8px;
    height: 8px;
    background: #1392ec;
    border: 1px solid #fff;
    border-radius: 50%;
    pointer-events: all;
    cursor: ${cfg.cursor};
    z-index: 2147483647;
    ${pos}
    transform: translate(-50%, -50%);
  `;

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleResizeStart(e, cfg);
  });

  return handle;
}

function getHandlePosition(pos: string): string {
  const map: Record<string, string> = {
    nw: 'left: 0; top: 0;',
    n:  'left: 50%; top: 0;',
    ne: 'left: 100%; top: 0;',
    w:  'left: 0; top: 50%;',
    e:  'left: 100%; top: 50%;',
    sw: 'left: 0; top: 100%;',
    s:  'left: 50%; top: 100%;',
    se: 'left: 100%; top: 100%;',
  };
  return map[pos] || '';
}

function handleResizeStart(e: MouseEvent, cfg: HandleConfig): void {
  const startX = e.clientX;
  const startY = e.clientY;
  const startBbox = { ...beforeBbox };

  const handleResizeMove = (me: MouseEvent): void => {
    me.preventDefault();
    const dx = me.clientX - startX;
    const dy = me.clientY - startY;

    let newX = startBbox.x;
    let newY = startBbox.y;
    let newW = startBbox.width;
    let newH = startBbox.height;

    if (cfg.xFactor === 1) {
      newW = Math.max(10, startBbox.width + dx);
    } else if (cfg.xFactor === -1) {
      newW = Math.max(10, startBbox.width - dx);
      newX = startBbox.x + (startBbox.width - newW);
    }

    if (cfg.yFactor === 1) {
      newH = Math.max(10, startBbox.height + dy);
    } else if (cfg.yFactor === -1) {
      newH = Math.max(10, startBbox.height - dy);
      newY = startBbox.y + (startBbox.height - newH);
    }

    updateHandlesPosition({ x: newX, y: newY, width: newW, height: newH });
  };

  const handleResizeEnd = (me: MouseEvent): void => {
    activeDragCleanup = null;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
    document.body.style.cursor = '';

    const dx = me.clientX - startX;
    const dy = me.clientY - startY;
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return; // ignore micro-drags

    let newW = startBbox.width;
    let newH = startBbox.height;
    let newX = startBbox.x;
    let newY = startBbox.y;

    if (cfg.xFactor === 1) newW = Math.max(10, startBbox.width + dx);
    else if (cfg.xFactor === -1) {
      newW = Math.max(10, startBbox.width - dx);
      newX = startBbox.x + (startBbox.width - newW);
    }
    if (cfg.yFactor === 1) newH = Math.max(10, startBbox.height + dy);
    else if (cfg.yFactor === -1) {
      newH = Math.max(10, startBbox.height - dy);
      newY = startBbox.y + (startBbox.height - newH);
    }

    const afterBbox: BoundingBox = { x: newX, y: newY, width: newW, height: newH };
    const delta: GestureDelta = {};

    if (cfg.xFactor === 1) delta.resize_right = newW - startBbox.width;
    if (cfg.xFactor === -1) delta.resize_left = startBbox.width - newW;
    if (cfg.yFactor === 1) delta.resize_bottom = newH - startBbox.height;
    if (cfg.yFactor === -1) delta.resize_top = startBbox.height - newH;

    emitGesture('resize', startBbox, afterBbox, delta);
    beforeBbox = afterBbox;
  };

  activeDragCleanup = () => {
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
    document.body.style.cursor = '';
  };

  document.body.style.cursor = cfg.cursor;
  document.addEventListener('mousemove', handleResizeMove);
  document.addEventListener('mouseup', handleResizeEnd);
}

function handleMoveStart(e: MouseEvent): void {
  e.preventDefault();
  e.stopPropagation();

  const startX = e.clientX;
  const startY = e.clientY;
  const startBbox = { ...beforeBbox };

  const handleMoveMove = (me: MouseEvent): void => {
    me.preventDefault();
    const dx = me.clientX - startX;
    const dy = me.clientY - startY;
    updateHandlesPosition({
      x: startBbox.x + dx,
      y: startBbox.y + dy,
      width: startBbox.width,
      height: startBbox.height,
    });
  };

  const handleMoveEnd = (me: MouseEvent): void => {
    activeDragCleanup = null;
    document.removeEventListener('mousemove', handleMoveMove);
    document.removeEventListener('mouseup', handleMoveEnd);
    document.body.style.cursor = '';

    const dx = me.clientX - startX;
    const dy = me.clientY - startY;
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;

    const afterBbox: BoundingBox = {
      x: startBbox.x + dx,
      y: startBbox.y + dy,
      width: startBbox.width,
      height: startBbox.height,
    };
    const delta: GestureDelta = { move_x: dx, move_y: dy };

    emitGesture('move', startBbox, afterBbox, delta);
    beforeBbox = afterBbox;
  };

  activeDragCleanup = () => {
    document.removeEventListener('mousemove', handleMoveMove);
    document.removeEventListener('mouseup', handleMoveEnd);
    document.body.style.cursor = '';
  };

  document.body.style.cursor = 'move';
  document.addEventListener('mousemove', handleMoveMove);
  document.addEventListener('mouseup', handleMoveEnd);
}

function emitGesture(
  type: ActionType,
  before: BoundingBox,
  after: BoundingBox,
  delta: GestureDelta
): void {
  if (!onGesture) return;

  const gesture: GestureEvent = {
    type,
    selector: currentSelector,
    before_bbox: before,
    after_bbox: after,
    delta,
    timestamp: Date.now(),
  };

  onGesture(gesture);
}
