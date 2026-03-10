/**
 * U:Echo — Overlay Engine Index
 * Central coordinator for grid/divbox renderers and gesture capture.
 */

export { renderGrid, destroyGrid, getSelectedCells, clearSelection } from './grid-renderer';
export { renderDivBox, destroyDivBox, getSelectedElement, getSelectedElementInfo, clearDivBoxSelection } from './divbox-renderer';
export { attachHandles, detachHandles, updateHandlesPosition } from './gesture-capture';
export type { GestureCallback } from './gesture-capture';
