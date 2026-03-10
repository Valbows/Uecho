/**
 * U:Echo — Div-Box Overlay Renderer
 * Highlights DOM elements on hover and allows click-to-select.
 * Uses a single floating highlight element repositioned via rAF for 60fps.
 */

import type { ElementInfo, BoundingBox } from '@shared/types';

let highlightEl: HTMLDivElement | null = null;
let tooltipEl: HTMLDivElement | null = null;
let selectedEl: HTMLDivElement | null = null;
let currentTarget: Element | null = null;
let selectedTarget: Element | null = null;
let isActive = false;

export function renderDivBox(container: HTMLDivElement): void {
  cleanup(container);
  isActive = true;

  // Floating highlight
  highlightEl = document.createElement('div');
  highlightEl.className = 'uecho-element-highlight';
  highlightEl.style.display = 'none';
  container.appendChild(highlightEl);

  // Selected element highlight
  selectedEl = document.createElement('div');
  selectedEl.className = 'uecho-element-highlight active';
  selectedEl.style.display = 'none';
  container.appendChild(selectedEl);

  // Tooltip
  tooltipEl = document.createElement('div');
  tooltipEl.className = 'uecho-tooltip';
  tooltipEl.style.display = 'none';
  container.appendChild(tooltipEl);

  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown, true);
}

export function destroyDivBox(container: HTMLDivElement): void {
  isActive = false;
  cleanup(container);
}

export function getSelectedElement(): Element | null {
  return selectedTarget;
}

export function getSelectedElementInfo(): ElementInfo | null {
  if (!selectedTarget) return null;
  return extractElementInfo(selectedTarget);
}

export function clearDivBoxSelection(): void {
  selectedTarget = null;
  if (selectedEl) selectedEl.style.display = 'none';
}

// ─── Internal ───────────────────────────────────────────────────

function handleMouseMove(e: MouseEvent): void {
  if (!isActive) return;

  // Skip our own overlay elements
  const target = getElementAtPoint(e.clientX, e.clientY);
  if (!target || target === currentTarget) return;
  currentTarget = target;

  const rect = target.getBoundingClientRect();
  positionHighlight(highlightEl!, rect);
  highlightEl!.style.display = 'block';

  // Update tooltip
  updateTooltip(target, rect);
}

function handleClick(e: MouseEvent): void {
  if (!isActive) return;

  const target = getElementAtPoint(e.clientX, e.clientY);
  if (!target) return;

  e.preventDefault();
  e.stopPropagation();

  selectedTarget = target;
  const rect = target.getBoundingClientRect();
  positionHighlight(selectedEl!, rect);
  selectedEl!.style.display = 'block';

  const info = extractElementInfo(target);
  dispatchElementSelection(info, rect);
}

function handleKeyDown(e: KeyboardEvent): void {
  if (!isActive) return;
  if (e.key === 'Escape') {
    clearDivBoxSelection();
    document.dispatchEvent(new CustomEvent('uecho:element-deselected'));
  }
}

function getElementAtPoint(x: number, y: number): Element | null {
  // Temporarily hide overlay to hit-test through it
  const overlayRoot = document.getElementById('uecho-overlay-root');
  if (overlayRoot) overlayRoot.style.display = 'none';

  const el = document.elementFromPoint(x, y);

  if (overlayRoot) overlayRoot.style.display = 'block';

  // Ignore body, html, and script/style elements
  if (
    !el ||
    el === document.body ||
    el === document.documentElement ||
    el.tagName === 'SCRIPT' ||
    el.tagName === 'STYLE' ||
    el.tagName === 'LINK'
  ) {
    return null;
  }

  return el;
}

function positionHighlight(el: HTMLDivElement, rect: DOMRect): void {
  el.style.left = `${rect.left}px`;
  el.style.top = `${rect.top}px`;
  el.style.width = `${rect.width}px`;
  el.style.height = `${rect.height}px`;
}

function updateTooltip(target: Element, rect: DOMRect): void {
  if (!tooltipEl) return;

  const tag = target.tagName.toLowerCase();
  const id = target.id ? `#${target.id}` : '';
  const classes = Array.from(target.classList)
    .filter((c) => !c.startsWith('uecho-'))
    .slice(0, 3)
    .map((c) => `.${c}`)
    .join('');

  const selector = `${tag}${id}${classes}`;
  const dims = `${Math.round(rect.width)}×${Math.round(rect.height)}`;

  tooltipEl.textContent = `${selector}  ${dims}`;
  tooltipEl.style.display = 'block';

  // Position above element, or below if near top
  const tooltipY =
    rect.top > 30 ? rect.top - 28 : rect.bottom + 4;
  const tooltipX = Math.max(4, Math.min(rect.left, window.innerWidth - 250));

  tooltipEl.style.left = `${tooltipX}px`;
  tooltipEl.style.top = `${tooltipY}px`;
}

function generateSelector(el: Element): string {
  if (el.id) return `#${el.id}`;

  const tag = el.tagName.toLowerCase();
  const classes = Array.from(el.classList)
    .filter((c) => !c.startsWith('uecho-'))
    .slice(0, 2);

  if (classes.length > 0) {
    return `${tag}.${classes.join('.')}`;
  }

  // Try nth-child
  const parent = el.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children).filter(
      (s) => s.tagName === el.tagName
    );
    if (siblings.length > 1) {
      const idx = siblings.indexOf(el) + 1;
      return `${tag}:nth-of-type(${idx})`;
    }
  }

  return tag;
}

function extractElementInfo(el: Element): ElementInfo {
  const rect = el.getBoundingClientRect();
  const computed = window.getComputedStyle(el);

  return {
    tag_name: el.tagName.toLowerCase(),
    selector: generateSelector(el),
    bounding_box: {
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height,
    },
    computed_styles: {
      font_size: computed.fontSize,
      color: computed.color,
      background_color: computed.backgroundColor,
      padding: computed.padding,
      margin: computed.margin,
      display: computed.display,
      position: computed.position,
    },
    class_list: Array.from(el.classList).filter((c) => !c.startsWith('uecho-')),
    id: el.id || undefined,
  };
}

function dispatchElementSelection(info: ElementInfo, rect: DOMRect): void {
  const bbox: BoundingBox = {
    x: rect.left + window.scrollX,
    y: rect.top + window.scrollY,
    width: rect.width,
    height: rect.height,
  };

  document.dispatchEvent(
    new CustomEvent('uecho:element-selected', {
      detail: { elementInfo: info, boundingBox: bbox },
    })
  );
}

function cleanup(_container: HTMLDivElement): void {
  document.removeEventListener('mousemove', handleMouseMove, true);
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('keydown', handleKeyDown, true);

  highlightEl?.remove();
  tooltipEl?.remove();
  selectedEl?.remove();

  highlightEl = null;
  tooltipEl = null;
  selectedEl = null;
  currentTarget = null;
  selectedTarget = null;
}
