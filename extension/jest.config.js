/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '\\.(css|less|scss)$': '<rootDir>/tests/__mocks__/styleMock.ts',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
        useESM: false,
      },
    ],
  },
  setupFiles: ['<rootDir>/tests/setup-chrome.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/sidepanel/index.tsx',
  ],
  testMatch: [
    '<rootDir>/tests/**/*.test.{ts,tsx}',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/tests/e2e/'],
};
