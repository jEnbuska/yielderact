/**
 * Playwright end-to-end tests for the yielderact examples app.
 *
 * These tests verify that the three example components (Counter, TodoList, and
 * ThemeDemo) are correctly rendered and interactive in real browsers
 * (Chromium, Firefox, WebKit/Safari).
 *
 * The Vite dev server is started automatically by playwright.config.ts.
 */
import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Navigate to the app and wait for it to be ready. */
async function goToApp(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.waitForSelector('h1');
}

/** Click the tab with the given label. */
async function clickTab(page: import('@playwright/test').Page, label: string) {
  await page.getByRole('tab', { name: label }).click();
}

// ---------------------------------------------------------------------------
// Page load
// ---------------------------------------------------------------------------

test.describe('App shell', () => {
  test('loads and shows the heading', async ({ page }) => {
    await goToApp(page);
    await expect(page.locator('h1')).toHaveText('yielderact examples');
    await page.screenshot({ path: 'test-results/app-loaded.png' });
  });

  test('shows all three tabs', async ({ page }) => {
    await goToApp(page);
    await expect(page.getByRole('tab', { name: 'Counter' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Todo List' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Context / Theme' })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Counter example
// ---------------------------------------------------------------------------

test.describe('Counter example', () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    // Counter tab is active by default
  });

  test('renders the counter with initial value 0', async ({ page }) => {
    await expect(page.locator('#counter-value')).toHaveText('0');
    await page.screenshot({ path: 'test-results/counter-initial.png' });
  });

  test('increments the counter', async ({ page }) => {
    await page.click('#increment-btn');
    await expect(page.locator('#counter-value')).toHaveText('1');

    await page.click('#increment-btn');
    await page.click('#increment-btn');
    await expect(page.locator('#counter-value')).toHaveText('3');
    await page.screenshot({ path: 'test-results/counter-incremented.png' });
  });

  test('decrements the counter', async ({ page }) => {
    await page.click('#decrement-btn');
    await expect(page.locator('#counter-value')).toHaveText('-1');
    await page.screenshot({ path: 'test-results/counter-decremented.png' });
  });

  test('resets the counter', async ({ page }) => {
    await page.click('#increment-btn');
    await page.click('#increment-btn');
    await expect(page.locator('#counter-value')).toHaveText('2');

    await page.click('#reset-btn');
    await expect(page.locator('#counter-value')).toHaveText('0');
    await page.screenshot({ path: 'test-results/counter-reset.png' });
  });
});

// ---------------------------------------------------------------------------
// Todo List example
// ---------------------------------------------------------------------------

test.describe('Todo List example', () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await clickTab(page, 'Todo List');
    await page.waitForSelector('#todo-input');
  });

  test('renders the initial todos', async ({ page }) => {
    const items = page.locator('#todo-list li');
    await expect(items).toHaveCount(2);
    await page.screenshot({ path: 'test-results/todos-initial.png' });
  });

  test('adds a new todo', async ({ page }) => {
    await page.fill('#todo-input', 'Write Playwright tests');
    await page.click('#add-todo-btn');

    const items = page.locator('#todo-list li');
    await expect(items).toHaveCount(3);
    await expect(items.last()).toContainText('Write Playwright tests');
    await page.screenshot({ path: 'test-results/todos-added.png' });
  });

  test('adds a todo by pressing Enter', async ({ page }) => {
    await page.fill('#todo-input', 'Press Enter to add');
    await page.press('#todo-input', 'Enter');

    await expect(page.locator('#todo-list li')).toHaveCount(3);
    await expect(page.locator('#todo-list li').last()).toContainText('Press Enter to add');
  });

  test('removes a todo', async ({ page }) => {
    // Remove the first todo
    await page.locator('#todo-list li').first().getByRole('button').click();
    await expect(page.locator('#todo-list li')).toHaveCount(1);
    await page.screenshot({ path: 'test-results/todos-removed.png' });
  });

  test('shows the empty message when all todos are removed', async ({ page }) => {
    await page.locator('#todo-list li').first().getByRole('button').click();
    await page.locator('#todo-list li').first().getByRole('button').click();
    await expect(page.locator('#empty-message')).toBeVisible();
    await page.screenshot({ path: 'test-results/todos-empty.png' });
  });

  test('does not add an empty todo', async ({ page }) => {
    await page.click('#add-todo-btn');
    await expect(page.locator('#todo-list li')).toHaveCount(2);
  });
});

// ---------------------------------------------------------------------------
// Context / Theme example
// ---------------------------------------------------------------------------

test.describe('Context / Theme example', () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await clickTab(page, 'Context / Theme');
    await page.waitForSelector('#toggle-theme-btn');
  });

  test('renders with the light theme by default', async ({ page }) => {
    await expect(page.locator('#theme-value')).toHaveText('light');
    await page.screenshot({ path: 'test-results/theme-light.png' });
  });

  test('toggles to dark theme', async ({ page }) => {
    await page.click('#toggle-theme-btn');
    await expect(page.locator('#theme-value')).toHaveText('dark');
    await page.screenshot({ path: 'test-results/theme-dark.png' });
  });

  test('toggles back to light theme', async ({ page }) => {
    await page.click('#toggle-theme-btn');
    await page.click('#toggle-theme-btn');
    await expect(page.locator('#theme-value')).toHaveText('light');
    await page.screenshot({ path: 'test-results/theme-light-again.png' });
  });

  test('themed card is visible', async ({ page }) => {
    await expect(page.locator('#themed-card')).toBeVisible();
    await page.screenshot({ path: 'test-results/theme-card.png' });
  });
});
