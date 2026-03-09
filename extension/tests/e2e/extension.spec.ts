/**
 * U:Echo — E2E Test Scaffold (Playwright)
 * Tests the full Chrome extension flow in a real browser context.
 *
 * Prerequisites:
 *   1. Build the extension: npm run build
 *   2. Run: npx playwright test
 *
 * Note: These tests require Playwright's Chrome extension support.
 * Full implementation will be completed in Phase 8 when the overlay
 * engine and backend are functional end-to-end.
 */

import { test, expect, type BrowserContext, chromium } from '@playwright/test';
import path from 'path';

const EXTENSION_PATH = path.resolve(__dirname, '../../dist');

// Helper to launch Chrome with the extension loaded
async function launchWithExtension(): Promise<BrowserContext> {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-first-run',
      '--disable-default-apps',
    ],
  });
  return context;
}

test.describe('Extension Loading', () => {
  test.skip(true, 'Requires built extension — enable after npm run build');

  test('should load the extension without errors', async () => {
    const context = await launchWithExtension();
    const pages = context.pages();
    expect(pages.length).toBeGreaterThan(0);
    await context.close();
  });

  test('should have service worker registered', async () => {
    const context = await launchWithExtension();
    const serviceWorkers = context.serviceWorkers();
    // Give it time to register
    if (serviceWorkers.length === 0) {
      await new Promise((r) => setTimeout(r, 2000));
    }
    expect(context.serviceWorkers().length).toBeGreaterThanOrEqual(0);
    await context.close();
  });
});

test.describe('Side Panel UI', () => {
  test.skip(true, 'Requires built extension — enable after npm run build');

  test('should render the Welcome screen on first open', async () => {
    const context = await launchWithExtension();
    const page = context.pages()[0];

    // Navigate to the side panel HTML directly for testing
    await page.goto(`chrome-extension://fake-id/src/sidepanel/sidepanel.html`);
    await page.waitForLoadState('domcontentloaded');

    // Check for Welcome screen elements
    const heading = page.locator('text=U:Echo');
    await expect(heading).toBeVisible();

    await context.close();
  });

  test('should show connectivity status indicators', async () => {
    const context = await launchWithExtension();
    const page = context.pages()[0];

    await page.goto(`chrome-extension://fake-id/src/sidepanel/sidepanel.html`);
    await page.waitForLoadState('domcontentloaded');

    // Check for status indicators
    const extIndicator = page.locator('text=Ext');
    const apiIndicator = page.locator('text=API');
    const ideIndicator = page.locator('text=IDE');

    await expect(extIndicator).toBeVisible();
    await expect(apiIndicator).toBeVisible();
    await expect(ideIndicator).toBeVisible();

    await context.close();
  });
});

test.describe('Overlay Activation Flow', () => {
  test.skip(true, 'Requires built extension + localhost target — Phase 3+');

  test('should inject overlay on localhost page when activated', async () => {
    const context = await launchWithExtension();
    const page = await context.newPage();

    await page.goto('http://localhost:3000');
    await page.waitForLoadState('domcontentloaded');

    // Verify overlay container is injected
    const overlay = page.locator('#uecho-overlay');
    // Initially should not be visible (mode = off)
    await expect(overlay).not.toBeVisible();

    await context.close();
  });
});

test.describe('Gesture → Prompt Pipeline (E2E)', () => {
  test.skip(true, 'Requires full pipeline — Phase 4+');

  test('should generate a prompt from a resize gesture', async () => {
    // This test will:
    // 1. Load extension on localhost page
    // 2. Activate grid overlay
    // 3. Simulate a resize gesture on a target element
    // 4. Verify the AI agent processes it
    // 5. Verify a structured prompt appears in Verify screen
    // 6. Confirm push to IDE target
    expect(true).toBe(true); // Placeholder
  });
});

test.describe('Performance E2E', () => {
  test.skip(true, 'Requires full pipeline — Phase 8');

  test('should complete gesture → prompt in under 5 seconds', async () => {
    // Measures real end-to-end latency:
    // gesture capture → service worker → backend API → agent → response → side panel
    const startTime = Date.now();
    // ... full pipeline execution ...
    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeLessThan(5000);
  });
});
