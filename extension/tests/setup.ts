/**
 * U:Echo — Jest Test Setup
 * Provides Chrome API mocks and global test utilities.
 */

import '@testing-library/jest-dom';

// ─── Chrome API Mock ────────────────────────────────────────────
const chromeMock = {
  runtime: {
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn(() => false),
    },
    sendMessage: jest.fn((_message: unknown, callback?: (response: unknown) => void) => {
      if (callback) callback({ ok: true });
    }),
    onInstalled: {
      addListener: jest.fn(),
    },
    id: 'mock-extension-id',
  },
  tabs: {
    query: jest.fn(() => Promise.resolve([{ id: 1, url: 'http://localhost:3000' }])),
    sendMessage: jest.fn((_tabId: number, _message: unknown, callback?: (response: unknown) => void) => {
      if (callback) callback({ ok: true });
    }),
    captureVisibleTab: jest.fn(() => Promise.resolve('data:image/png;base64,mockScreenshot')),
  },
  sidePanel: {
    setPanelBehavior: jest.fn(() => Promise.resolve()),
  },
  storage: {
    local: {
      get: jest.fn((_keys: unknown, callback?: (items: Record<string, unknown>) => void) => {
        if (callback) callback({});
        return Promise.resolve({});
      }),
      set: jest.fn((_items: unknown, callback?: () => void) => {
        if (callback) callback();
        return Promise.resolve();
      }),
    },
  },
};

Object.defineProperty(global, 'chrome', {
  value: chromeMock,
  writable: true,
});

// ─── Crypto Mock ────────────────────────────────────────────────
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'mock-uuid-1234-5678-abcd-ef0123456789',
  },
});
