/**
 * U:Echo — Jest Setup: Chrome API Mocks
 * Runs before test framework is installed (setupFiles).
 */

const chromeMock = {
  runtime: {
    onMessage: {
      addListener: (): void => {},
      removeListener: (): void => {},
      hasListener: (): boolean => false,
    },
    sendMessage: (_message: unknown, callback?: (response: unknown) => void): void => {
      if (callback) callback({ ok: true });
    },
    onInstalled: {
      addListener: (): void => {},
    },
    id: 'mock-extension-id',
  },
  tabs: {
    query: (): Promise<Array<{ id: number; url: string }>> =>
      Promise.resolve([{ id: 1, url: 'http://localhost:3000' }]),
    sendMessage: (_tabId: number, _message: unknown, callback?: (response: unknown) => void): void => {
      if (callback) callback({ ok: true });
    },
    captureVisibleTab: (): Promise<string> =>
      Promise.resolve('data:image/png;base64,mockScreenshot'),
  },
  sidePanel: {
    setPanelBehavior: (): Promise<void> => Promise.resolve(),
  },
  storage: {
    local: {
      get: (_keys: unknown, callback?: (items: Record<string, unknown>) => void): Promise<Record<string, unknown>> => {
        if (callback) callback({});
        return Promise.resolve({});
      },
      set: (_items: unknown, callback?: () => void): Promise<void> => {
        if (callback) callback();
        return Promise.resolve();
      },
    },
  },
};

Object.defineProperty(global, 'chrome', {
  value: chromeMock,
  writable: true,
});

Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: (): string => 'mock-uuid-1234-5678-abcd-ef0123456789',
  },
});
