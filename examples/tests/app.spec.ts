/**
 * Playwright end-to-end tests for the yielderact examples app.
 *
 * These tests verify that the five example components (Counter, TodoList,
 * ThemeDemo, DataFetcher, HooksShowcase) are correctly rendered and
 * interactive in real browsers (Chromium, Firefox, WebKit/Safari).
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

  test('shows all five tabs', async ({ page }) => {
    await goToApp(page);
    await expect(page.getByRole('tab', { name: 'Counter' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Todo List' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Context / Theme' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Data Fetcher' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Hooks Showcase' })).toBeVisible();
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
    await expect(page.getByTestId('counter-value')).toHaveText('0');
    await page.screenshot({ path: 'test-results/counter-initial.png' });
  });

  test('increments the counter', async ({ page }) => {
    await page.getByTestId('increment-btn').click();
    await expect(page.getByTestId('counter-value')).toHaveText('1');

    await page.getByTestId('increment-btn').click();
    await page.getByTestId('increment-btn').click();
    await expect(page.getByTestId('counter-value')).toHaveText('3');
    await page.screenshot({ path: 'test-results/counter-incremented.png' });
  });

  test('decrements the counter', async ({ page }) => {
    await page.getByTestId('decrement-btn').click();
    await expect(page.getByTestId('counter-value')).toHaveText('-1');
    await page.screenshot({ path: 'test-results/counter-decremented.png' });
  });

  test('resets the counter', async ({ page }) => {
    await page.getByTestId('increment-btn').click();
    await page.getByTestId('increment-btn').click();
    await expect(page.getByTestId('counter-value')).toHaveText('2');

    await page.getByTestId('reset-btn').click();
    await expect(page.getByTestId('counter-value')).toHaveText('0');
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
    await page.waitForSelector('[data-testid="todo-input"]');
  });

  test('renders the initial todos', async ({ page }) => {
    const items = page.locator('[data-testid="todo-list"] li');
    await expect(items).toHaveCount(2);
    await page.screenshot({ path: 'test-results/todos-initial.png' });
  });

  test('adds a new todo', async ({ page }) => {
    await page.getByTestId('todo-input').fill('Write Playwright tests');
    await page.getByTestId('add-todo-btn').click();

    const items = page.locator('[data-testid="todo-list"] li');
    await expect(items).toHaveCount(3);
    await expect(items.last()).toContainText('Write Playwright tests');
    await page.screenshot({ path: 'test-results/todos-added.png' });
  });

  test('adds a todo by pressing Enter', async ({ page }) => {
    await page.getByTestId('todo-input').fill('Press Enter to add');
    await page.getByTestId('todo-input').press('Enter');

    await expect(page.locator('[data-testid="todo-list"] li')).toHaveCount(3);
    await expect(page.locator('[data-testid="todo-list"] li').last()).toContainText(
      'Press Enter to add',
    );
  });

  test('removes a todo', async ({ page }) => {
    // Remove the first todo
    await page.locator('[data-testid="todo-list"] li').first().getByRole('button').click();
    await expect(page.locator('[data-testid="todo-list"] li')).toHaveCount(1);
    await page.screenshot({ path: 'test-results/todos-removed.png' });
  });

  test('shows the empty message when all todos are removed', async ({ page }) => {
    await page.locator('[data-testid="todo-list"] li').first().getByRole('button').click();
    await page.locator('[data-testid="todo-list"] li').first().getByRole('button').click();
    await expect(page.getByTestId('empty-message')).toBeVisible();
    await page.screenshot({ path: 'test-results/todos-empty.png' });
  });

  test('does not add an empty todo', async ({ page }) => {
    await page.getByTestId('add-todo-btn').click();
    await expect(page.locator('[data-testid="todo-list"] li')).toHaveCount(2);
  });
});

// ---------------------------------------------------------------------------
// Context / Theme example
// ---------------------------------------------------------------------------

test.describe('Context / Theme example', () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await clickTab(page, 'Context / Theme');
    await page.waitForSelector('[data-testid="toggle-theme-btn"]');
  });

  test('renders with the light theme by default', async ({ page }) => {
    await expect(page.getByTestId('theme-value')).toHaveText('light');
    await page.screenshot({ path: 'test-results/theme-light.png' });
  });

  test('toggles to dark theme', async ({ page }) => {
    await page.getByTestId('toggle-theme-btn').click();
    await expect(page.getByTestId('theme-value')).toHaveText('dark');
    await page.screenshot({ path: 'test-results/theme-dark.png' });
  });

  test('toggles back to light theme', async ({ page }) => {
    await page.getByTestId('toggle-theme-btn').click();
    await page.getByTestId('toggle-theme-btn').click();
    await expect(page.getByTestId('theme-value')).toHaveText('light');
    await page.screenshot({ path: 'test-results/theme-light-again.png' });
  });

  test('themed card is visible', async ({ page }) => {
    await expect(page.getByTestId('themed-card')).toBeVisible();
    await page.screenshot({ path: 'test-results/theme-card.png' });
  });
});

// ---------------------------------------------------------------------------
// Data Fetcher example
// ---------------------------------------------------------------------------

test.describe('Data Fetcher example', () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await clickTab(page, 'Data Fetcher');
  });

  test('shows loading state initially', async ({ page }) => {
    await expect(page.getByTestId('loading-message')).toBeVisible();
    await page.screenshot({ path: 'test-results/data-loading.png' });
  });

  test('shows user data after promise resolves', async ({ page }) => {
    // Wait up to 5 s for the simulated 1.5 s fetch to complete
    await expect(page.getByTestId('user-data')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('user-data')).toContainText('Jane Doe');
    await page.screenshot({ path: 'test-results/data-loaded.png' });
  });
});

// ---------------------------------------------------------------------------
// Hooks Showcase example
// ---------------------------------------------------------------------------

test.describe('Hooks Showcase example', () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await clickTab(page, 'Hooks Showcase');
    await page.waitForSelector('[data-testid="hooks-search-input"]');
  });

  test('renders the full fruit list initially', async ({ page }) => {
    const items = page.locator('[data-testid="hooks-fruit-list"] li');
    await expect(items).toHaveCount(12);
    await page.screenshot({ path: 'test-results/hooks-initial.png' });
  });

  test('filters the list via useMemo when the search input changes', async ({ page }) => {
    await page.getByTestId('hooks-search-input').fill('an');
    const items = page.locator('[data-testid="hooks-fruit-list"] li');
    // 'Banana', 'Mango', 'Nectarine' contain 'an'
    await expect(items).toHaveCount(3);
    await page.screenshot({ path: 'test-results/hooks-filtered.png' });
  });

  test('shows no-results message when no fruits match', async ({ page }) => {
    await page.getByTestId('hooks-search-input').fill('zzz');
    await expect(page.getByTestId('hooks-no-results')).toBeVisible();
    await page.screenshot({ path: 'test-results/hooks-no-results.png' });
  });

  test('shows render count tracked by useRef', async ({ page }) => {
    await expect(page.getByTestId('hooks-render-count')).toContainText('rendered');
    await page.screenshot({ path: 'test-results/hooks-render-count.png' });
  });

  test('search input label is associated via useId', async ({ page }) => {
    const input = page.getByTestId('hooks-search-input');
    const inputId = await input.getAttribute('id');
    expect(inputId).toBeTruthy();
    // The label's htmlFor must match the input's id
    const label = page.locator(`label[for="${inputId}"]`);
    await expect(label).toBeVisible();
  });
});
