/**
 * U:Echo — Grid Overlay Renderer
 * Renders a configurable grid over the page using CSS background-image
 * for 60fps performance (no individual DOM elements per cell).
 */

import { DEFAULT_GRID_CELL_SIZE } from '@shared/constants';

export interface GridConfig {
  cellSize: number;
  color: string;
  opacity: number;
}

const DEFAULT_CONFIG: GridConfig = {
  cellSize: DEFAULT_GRID_CELL_SIZE,
  color: '19, 146, 236', // RGB for #1392ec
  opacity: 0.15,
};

let gridElement: HTMLDivElement | null = null;
let currentConfig: GridConfig = { ...DEFAULT_CONFIG };
let selectedCells: Set<string> = new Set();
let selectionOverlay: HTMLDivElement | null = null;

export function renderGrid(
  container: HTMLDivElement,
  config?: Partial<GridConfig>
): void {
  currentConfig = { ...DEFAULT_CONFIG, ...config };
  cleanup();

  gridElement = document.createElement('div');
  gridElement.className = 'uecho-grid-overlay';
  gridElement.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: all;
    cursor: crosshair;
    background-image:
      linear-gradient(to right, rgba(${currentConfig.color}, ${currentConfig.opacity}) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(${currentConfig.color}, ${currentConfig.opacity}) 1px, transparent 1px);
    background-size: ${currentConfig.cellSize}px ${currentConfig.cellSize}px;
  `;

  // Selection overlay for highlighting cells
  selectionOverlay = document.createElement('div');
  selectionOverlay.className = 'uecho-grid-selections';
  selectionOverlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  `;

  gridElement.addEventListener('mousemove', handleGridHover);
  gridElement.addEventListener('click', handleGridClick);
  gridElement.addEventListener('mousedown', handleGridDragStart);

  container.appendChild(gridElement);
  container.appendChild(selectionOverlay);
}

export function destroyGrid(container: HTMLDivElement): void {
  cleanup();
  selectedCells.clear();
}

export function getSelectedCells(): Array<{
  col: number;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
}> {
  return Array.from(selectedCells).map((key) => {
    const [col, row] = key.split(',').map(Number);
    return {
      col,
      row,
      x: col * currentConfig.cellSize,
      y: row * currentConfig.cellSize,
      width: currentConfig.cellSize,
      height: currentConfig.cellSize,
    };
  });
}

export function clearSelection(): void {
  selectedCells.clear();
  if (selectionOverlay) selectionOverlay.innerHTML = '';
}

// ─── Internal Handlers ──────────────────────────────────────────

let hoverHighlight: HTMLDivElement | null = null;

function handleGridHover(e: MouseEvent): void {
  const { col, row } = getCellFromEvent(e);
  if (!hoverHighlight) {
    hoverHighlight = document.createElement('div');
    hoverHighlight.style.cssText = `
      position: absolute;
      pointer-events: none;
      background-color: rgba(${currentConfig.color}, 0.08);
      border: 1px solid rgba(${currentConfig.color}, 0.3);
      transition: all 0.05s ease;
      box-sizing: border-box;
    `;
    selectionOverlay?.appendChild(hoverHighlight);
  }
  hoverHighlight.style.left = `${col * currentConfig.cellSize}px`;
  hoverHighlight.style.top = `${row * currentConfig.cellSize}px`;
  hoverHighlight.style.width = `${currentConfig.cellSize}px`;
  hoverHighlight.style.height = `${currentConfig.cellSize}px`;
  hoverHighlight.style.display = 'block';
}

function handleGridClick(e: MouseEvent): void {
  // Skip click if it's the trailing click after a drag
  if (Date.now() - lastDragEndTimestamp < 50) return;

  const { col, row } = getCellFromEvent(e);
  const key = `${col},${row}`;

  if (e.shiftKey) {
    // Toggle cell selection with shift
    if (selectedCells.has(key)) {
      selectedCells.delete(key);
    } else {
      selectedCells.add(key);
    }
  } else {
    // Single cell selection
    selectedCells.clear();
    selectedCells.add(key);
  }

  renderSelections();
  dispatchGridSelection();
}

let isDragging = false;
let dragStart: { col: number; row: number } | null = null;
let lastDragEndTimestamp = 0;
let activeDragMoveHandler: ((e: MouseEvent) => void) | null = null;
let activeDragEndHandler: (() => void) | null = null;

function handleGridDragStart(e: MouseEvent): void {
  if (e.button !== 0) return;

  // Clean up any prior drag listeners
  cleanupDragListeners();

  isDragging = true;
  dragStart = getCellFromEvent(e);

  activeDragMoveHandler = (me: MouseEvent): void => {
    if (!isDragging || !dragStart) return;
    const current = getCellFromEvent(me);
    selectRange(dragStart!, current);
  };

  activeDragEndHandler = (): void => {
    cleanupDragListeners();
    dispatchGridSelection();
  };

  document.addEventListener('mousemove', activeDragMoveHandler);
  document.addEventListener('mouseup', activeDragEndHandler);
}

function cleanupDragListeners(): void {
  if (activeDragMoveHandler) {
    document.removeEventListener('mousemove', activeDragMoveHandler);
    activeDragMoveHandler = null;
  }
  if (activeDragEndHandler) {
    document.removeEventListener('mouseup', activeDragEndHandler);
    activeDragEndHandler = null;
  }
  isDragging = false;
  dragStart = null;
  lastDragEndTimestamp = Date.now();
}

function selectRange(
  start: { col: number; row: number },
  end: { col: number; row: number }
): void {
  selectedCells.clear();
  const minCol = Math.min(start.col, end.col);
  const maxCol = Math.max(start.col, end.col);
  const minRow = Math.min(start.row, end.row);
  const maxRow = Math.max(start.row, end.row);

  for (let c = minCol; c <= maxCol; c++) {
    for (let r = minRow; r <= maxRow; r++) {
      selectedCells.add(`${c},${r}`);
    }
  }
  renderSelections();
}

function renderSelections(): void {
  if (!selectionOverlay) return;

  // Keep hover highlight, remove selection rects
  const existing = selectionOverlay.querySelectorAll('.uecho-grid-selected');
  existing.forEach((el) => el.remove());

  selectedCells.forEach((key) => {
    const [col, row] = key.split(',').map(Number);
    const rect = document.createElement('div');
    rect.className = 'uecho-grid-selected';
    rect.style.cssText = `
      position: absolute;
      left: ${col * currentConfig.cellSize}px;
      top: ${row * currentConfig.cellSize}px;
      width: ${currentConfig.cellSize}px;
      height: ${currentConfig.cellSize}px;
      background-color: rgba(${currentConfig.color}, 0.20);
      border: 1px solid rgba(${currentConfig.color}, 0.5);
      box-sizing: border-box;
      pointer-events: none;
    `;
    selectionOverlay!.appendChild(rect);
  });
}

function getCellFromEvent(e: MouseEvent): { col: number; row: number } {
  const rect = gridElement!.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  return {
    col: Math.floor(x / currentConfig.cellSize),
    row: Math.floor(y / currentConfig.cellSize),
  };
}

function dispatchGridSelection(): void {
  const cells = getSelectedCells();
  if (cells.length === 0) return;

  // Calculate bounding box of selected region
  const minX = Math.min(...cells.map((c) => c.x));
  const minY = Math.min(...cells.map((c) => c.y));
  const maxX = Math.max(...cells.map((c) => c.x + c.width));
  const maxY = Math.max(...cells.map((c) => c.y + c.height));

  const detail = {
    cells,
    region: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
    cellSize: currentConfig.cellSize,
  };

  document.dispatchEvent(
    new CustomEvent('uecho:grid-selection', { detail })
  );
}

function cleanup(): void {
  cleanupDragListeners();

  if (gridElement) {
    gridElement.removeEventListener('mousemove', handleGridHover);
    gridElement.removeEventListener('click', handleGridClick);
    gridElement.removeEventListener('mousedown', handleGridDragStart);
    gridElement.remove();
    gridElement = null;
  }
  if (selectionOverlay) {
    selectionOverlay.remove();
    selectionOverlay = null;
  }
  hoverHighlight = null;
}
