/**
 * U:Echo — Unit Tests: Overlay Engine
 * Tests grid renderer, divbox renderer, and gesture capture logic.
 * Uses jsdom with mocked DOM APIs.
 */

import type { BoundingBox, GestureEvent } from '../../src/shared/types';

// ─── Grid Renderer Tests ────────────────────────────────────────

describe('Grid Renderer', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'uecho-overlay-root';
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    jest.restoreAllMocks();
  });

  it('should render a grid overlay element into the container', async () => {
    const { renderGrid } = await import('../../src/content/overlay/grid-renderer');
    renderGrid(container);

    const gridEl = container.querySelector('.uecho-grid-overlay');
    expect(gridEl).not.toBeNull();
    expect(gridEl).toBeInstanceOf(HTMLDivElement);
  });

  it('should apply CSS grid background with default 25px cell size', async () => {
    const { renderGrid } = await import('../../src/content/overlay/grid-renderer');
    renderGrid(container);

    const gridEl = container.querySelector('.uecho-grid-overlay') as HTMLDivElement;
    expect(gridEl.style.backgroundSize).toContain('25px');
  });

  it('should apply custom cell size when configured', async () => {
    const { renderGrid } = await import('../../src/content/overlay/grid-renderer');
    renderGrid(container, { cellSize: 50 });

    const gridEl = container.querySelector('.uecho-grid-overlay') as HTMLDivElement;
    expect(gridEl.style.backgroundSize).toContain('50px');
  });

  it('should create a selection overlay layer', async () => {
    const { renderGrid } = await import('../../src/content/overlay/grid-renderer');
    renderGrid(container);

    const selectionLayer = container.querySelector('.uecho-grid-selections');
    expect(selectionLayer).not.toBeNull();
  });

  it('should destroy grid and clean up children', async () => {
    const { renderGrid, destroyGrid } = await import('../../src/content/overlay/grid-renderer');
    renderGrid(container);
    expect(container.children.length).toBeGreaterThan(0);

    destroyGrid(container);
    const gridEl = container.querySelector('.uecho-grid-overlay');
    expect(gridEl).toBeNull();
  });

  it('should clear selection state on destroy', async () => {
    const { renderGrid, destroyGrid, getSelectedCells } = await import(
      '../../src/content/overlay/grid-renderer'
    );
    renderGrid(container);
    destroyGrid(container);
    expect(getSelectedCells()).toEqual([]);
  });

  it('should provide clearSelection utility', async () => {
    const { renderGrid, clearSelection, getSelectedCells } = await import(
      '../../src/content/overlay/grid-renderer'
    );
    renderGrid(container);
    clearSelection();
    expect(getSelectedCells()).toEqual([]);
  });
});

// ─── DivBox Renderer Tests ──────────────────────────────────────

describe('DivBox Renderer', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'uecho-overlay-root';
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    jest.restoreAllMocks();
  });

  it('should render highlight and tooltip elements into container', async () => {
    const { renderDivBox } = await import('../../src/content/overlay/divbox-renderer');
    renderDivBox(container);

    const highlight = container.querySelector('.uecho-element-highlight');
    const tooltip = container.querySelector('.uecho-tooltip');
    expect(highlight).not.toBeNull();
    expect(tooltip).not.toBeNull();
  });

  it('should render an active selection highlight element', async () => {
    const { renderDivBox } = await import('../../src/content/overlay/divbox-renderer');
    renderDivBox(container);

    const activeHighlight = container.querySelector('.uecho-element-highlight.active');
    expect(activeHighlight).not.toBeNull();
  });

  it('should start with no selected element', async () => {
    const { renderDivBox, getSelectedElement } = await import(
      '../../src/content/overlay/divbox-renderer'
    );
    renderDivBox(container);
    expect(getSelectedElement()).toBeNull();
  });

  it('should return null element info when nothing selected', async () => {
    const { renderDivBox, getSelectedElementInfo } = await import(
      '../../src/content/overlay/divbox-renderer'
    );
    renderDivBox(container);
    expect(getSelectedElementInfo()).toBeNull();
  });

  it('should clear selection state', async () => {
    const { renderDivBox, clearDivBoxSelection, getSelectedElement } = await import(
      '../../src/content/overlay/divbox-renderer'
    );
    renderDivBox(container);
    clearDivBoxSelection();
    expect(getSelectedElement()).toBeNull();
  });

  it('should destroy and clean up all elements', async () => {
    const { renderDivBox, destroyDivBox } = await import(
      '../../src/content/overlay/divbox-renderer'
    );
    renderDivBox(container);
    destroyDivBox(container);

    const highlight = container.querySelector('.uecho-element-highlight');
    const tooltip = container.querySelector('.uecho-tooltip');
    expect(highlight).toBeNull();
    expect(tooltip).toBeNull();
  });
});

// ─── Gesture Capture Tests ──────────────────────────────────────

describe('Gesture Capture', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'uecho-overlay-root';
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    jest.restoreAllMocks();
  });

  it('should attach handles container to the overlay', async () => {
    const { attachHandles } = await import('../../src/content/overlay/gesture-capture');

    const bbox: BoundingBox = { x: 100, y: 200, width: 200, height: 100 };
    attachHandles(container, bbox, '.test-el', jest.fn());

    const handles = container.querySelector('.uecho-handles-container');
    expect(handles).not.toBeNull();
  });

  it('should create 8 resize handles + 1 move handle', async () => {
    const { attachHandles } = await import('../../src/content/overlay/gesture-capture');

    const bbox: BoundingBox = { x: 0, y: 0, width: 100, height: 50 };
    attachHandles(container, bbox, '.btn', jest.fn());

    const resizeHandles = container.querySelectorAll('.uecho-resize-handle');
    expect(resizeHandles.length).toBe(8);

    const moveHandle = container.querySelector('.uecho-move-handle');
    expect(moveHandle).not.toBeNull();
  });

  it('should position handles at the bounding box location', async () => {
    const { attachHandles } = await import('../../src/content/overlay/gesture-capture');

    const bbox: BoundingBox = { x: 50, y: 75, width: 300, height: 150 };
    attachHandles(container, bbox, '#main', jest.fn());

    const handlesContainer = container.querySelector('.uecho-handles-container') as HTMLDivElement;
    expect(handlesContainer.style.width).toBe('300px');
    expect(handlesContainer.style.height).toBe('150px');
  });

  it('should detach handles and clean up', async () => {
    const { attachHandles, detachHandles } = await import(
      '../../src/content/overlay/gesture-capture'
    );

    const bbox: BoundingBox = { x: 0, y: 0, width: 100, height: 50 };
    attachHandles(container, bbox, '.el', jest.fn());
    detachHandles();

    const handles = container.querySelector('.uecho-handles-container');
    expect(handles).toBeNull();
  });

  it('should update handles position dynamically', async () => {
    const { attachHandles, updateHandlesPosition } = await import(
      '../../src/content/overlay/gesture-capture'
    );

    const bbox: BoundingBox = { x: 0, y: 0, width: 100, height: 50 };
    attachHandles(container, bbox, '.el', jest.fn());

    updateHandlesPosition({ x: 20, y: 30, width: 150, height: 80 });

    const handlesContainer = container.querySelector('.uecho-handles-container') as HTMLDivElement;
    expect(handlesContainer.style.width).toBe('150px');
    expect(handlesContainer.style.height).toBe('80px');
  });

  it('should include all 8 directional handles (nw,n,ne,w,e,sw,s,se)', async () => {
    const { attachHandles } = await import('../../src/content/overlay/gesture-capture');

    const bbox: BoundingBox = { x: 0, y: 0, width: 100, height: 50 };
    attachHandles(container, bbox, '.el', jest.fn());

    const positions = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];
    positions.forEach((pos) => {
      const handle = container.querySelector(`.uecho-handle-${pos}`);
      expect(handle).not.toBeNull();
    });
  });
});

// ─── Content Script Integration Tests ───────────────────────────

describe('Overlay Engine: Mode Switching', () => {
  it('should export all required functions from index', async () => {
    const overlay = await import('../../src/content/overlay/index');
    expect(overlay.renderGrid).toBeDefined();
    expect(overlay.destroyGrid).toBeDefined();
    expect(overlay.renderDivBox).toBeDefined();
    expect(overlay.destroyDivBox).toBeDefined();
    expect(overlay.attachHandles).toBeDefined();
    expect(overlay.detachHandles).toBeDefined();
    expect(overlay.getSelectedCells).toBeDefined();
    expect(overlay.getSelectedElementInfo).toBeDefined();
    expect(overlay.clearSelection).toBeDefined();
    expect(overlay.clearDivBoxSelection).toBeDefined();
    expect(overlay.updateHandlesPosition).toBeDefined();
  });
});
