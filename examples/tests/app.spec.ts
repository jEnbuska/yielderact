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
  await page.waitForSelector('[data-testid="app-heading"]');
}

/** Map of tab labels used in tests → their data-testid values. */
const tabIds: Record<string, string> = {
  Counter: 'tab-counter',
  'Todo List': 'tab-todos',
  'Context / Theme': 'tab-theme',
  'Data Fetcher': 'tab-data',
  'Hooks Showcase': 'tab-hooks',
  '$shown prop': 'tab-shown',
  'UI Patch': 'tab-transition',
  'Lazy Context': 'tab-lazy-ctx',
  'AbortSignal Effect': 'tab-abort-signal',
};

/** Click the tab with the given label. */
async function clickTab(page: import('@playwright/test').Page, label: string) {
  await page.getByTestId(tabIds[label]).click();
}

// ---------------------------------------------------------------------------
// Page load
// ---------------------------------------------------------------------------

test.describe('App shell', () => {
  test('loads and shows the heading', async ({ page }) => {
    await goToApp(page);
    await expect(page.getByTestId('app-heading')).toHaveText('yielderact examples');
    await page.screenshot({ path: 'test-results/app-loaded.png' });
  });

  test('shows all five tabs', async ({ page }) => {
    await goToApp(page);
    await expect(page.getByTestId('tab-counter')).toBeVisible();
    await expect(page.getByTestId('tab-todos')).toBeVisible();
    await expect(page.getByTestId('tab-theme')).toBeVisible();
    await expect(page.getByTestId('tab-data')).toBeVisible();
    await expect(page.getByTestId('tab-hooks')).toBeVisible();
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
    await expect(page.getByTestId('todo-item-1')).toBeVisible();
    await expect(page.getByTestId('todo-item-2')).toBeVisible();
    await page.screenshot({ path: 'test-results/todos-initial.png' });
  });

  test('adds a new todo', async ({ page }) => {
    await page.getByTestId('todo-input').fill('Write Playwright tests');
    await page.getByTestId('add-todo-btn').click();

    await expect(page.getByTestId('todo-item-3')).toBeVisible();
    await expect(page.getByTestId('todo-item-3')).toContainText('Write Playwright tests');
    await page.screenshot({ path: 'test-results/todos-added.png' });
  });

  test('adds a todo by pressing Enter', async ({ page }) => {
    await page.getByTestId('todo-input').fill('Press Enter to add');
    await page.getByTestId('todo-input').press('Enter');

    await expect(page.getByTestId('todo-item-3')).toBeVisible();
    await expect(page.getByTestId('todo-item-3')).toContainText('Press Enter to add');
  });

  test('removes a todo', async ({ page }) => {
    // Remove the first todo
    await page.getByTestId('todo-remove-1').click();
    await expect(page.getByTestId('todo-item-1')).not.toBeAttached();
    await expect(page.getByTestId('todo-item-2')).toBeVisible();
    await page.screenshot({ path: 'test-results/todos-removed.png' });
  });

  test('shows the empty message when all todos are removed', async ({ page }) => {
    await page.getByTestId('todo-remove-1').click();
    await page.getByTestId('todo-remove-2').click();
    await expect(page.getByTestId('empty-message')).toBeVisible();
    await page.screenshot({ path: 'test-results/todos-empty.png' });
  });

  test('does not add an empty todo', async ({ page }) => {
    await page.getByTestId('add-todo-btn').click();
    // Still only the original 2 items
    await expect(page.getByTestId('todo-item-1')).toBeVisible();
    await expect(page.getByTestId('todo-item-2')).toBeVisible();
    await expect(page.getByTestId('todo-item-3')).not.toBeAttached();
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
    const items = page.locator('[data-testid^="fruit-"]');
    await expect(items).toHaveCount(12);
    await page.screenshot({ path: 'test-results/hooks-initial.png' });
  });

  test('filters the list via useMemo when the search input changes', async ({ page }) => {
    await page.getByTestId('hooks-search-input').fill('an');
    const items = page.locator('[data-testid^="fruit-"]');
    // 'Banana', 'Mango' contain 'an' (Nectarine does not)
    await expect(items).toHaveCount(2);
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
    const label = page.getByTestId('hooks-search-label');
    await expect(label).toBeVisible();
    const labelFor = await label.getAttribute('for');
    expect(labelFor).toBe(inputId);
  });
});

// ---------------------------------------------------------------------------
// shown prop example
// ---------------------------------------------------------------------------

test.describe('shown prop example', () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await clickTab(page, '$shown prop');
    await page.waitForSelector('[data-testid="toggle-element"]');
  });

  test('all three items are visible by default', async ({ page }) => {
    await expect(page.getByTestId('shown-element')).toBeVisible();
    await expect(page.getByTestId('info-panel')).toBeVisible();
    await expect(page.getByTestId('stateful-counter')).toBeVisible();
    await page.screenshot({ path: 'test-results/shown-all-visible.png' });
  });

  test('hides and shows the HTML element', async ({ page }) => {
    await page.getByTestId('toggle-element').uncheck();
    await expect(page.getByTestId('shown-element')).not.toBeAttached();
    await page.screenshot({ path: 'test-results/shown-element-hidden.png' });

    await page.getByTestId('toggle-element').check();
    await expect(page.getByTestId('shown-element')).toBeVisible();
    await page.screenshot({ path: 'test-results/shown-element-shown.png' });
  });

  test('hides and shows the function component', async ({ page }) => {
    await page.getByTestId('toggle-function').uncheck();
    await expect(page.getByTestId('info-panel')).not.toBeAttached();
    await page.screenshot({ path: 'test-results/shown-function-hidden.png' });

    await page.getByTestId('toggle-function').check();
    await expect(page.getByTestId('info-panel')).toBeVisible();
    await page.screenshot({ path: 'test-results/shown-function-shown.png' });
  });

  test('hides and shows the generator component', async ({ page }) => {
    await page.getByTestId('toggle-generator').uncheck();
    await expect(page.getByTestId('stateful-counter')).not.toBeAttached();
    await page.screenshot({ path: 'test-results/shown-generator-hidden.png' });

    await page.getByTestId('toggle-generator').check();
    await expect(page.getByTestId('stateful-counter')).toBeVisible();
    await page.screenshot({ path: 'test-results/shown-generator-shown.png' });
  });

  test('generator component state resets after re-mount', async ({ page }) => {
    // Increment the counter inside the generator component
    await page.getByTestId('counter-inc').click();
    await page.getByTestId('counter-inc').click();
    await expect(page.getByTestId('counter-val')).toHaveText('2');

    // Hide then re-show — state should reset to 0
    await page.getByTestId('toggle-generator').uncheck();
    await page.getByTestId('toggle-generator').check();
    await expect(page.getByTestId('counter-val')).toHaveText('0');
    await page.screenshot({ path: 'test-results/shown-generator-reset.png' });
  });
});

// ---------------------------------------------------------------------------
// UI Patch (TransitionDemo) example
// ---------------------------------------------------------------------------

test.describe('UI Patch example', () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await clickTab(page, 'UI Patch');
    // Wait for the Global patch section to appear
    await page.waitForSelector('[data-testid="global-patch-demo"]');
  });

  test('renders both global and local patch sections', async ({ page }) => {
    await expect(page.getByTestId('global-patch-heading')).toBeVisible();
    await expect(page.getByTestId('local-patch-heading')).toBeVisible();
    await page.screenshot({ path: 'test-results/ui-patch-initial.png' });
  });

  test('global patch: home page is shown by default', async ({ page }) => {
    await expect(page.getByTestId('page-home').first()).toBeVisible();
    await page.screenshot({ path: 'test-results/ui-patch-home.png' });
  });

  // ── Navigation button state regression ──────────────────────────────────
  // Regression for the bug where navigation buttons stayed disabled/cursor:wait
  // after the UI patch committed, because prevSlot.props was pre-emptively
  // updated during the live-only pass, causing shallowEqual to skip the
  // Navigation component at commit time.

  test('global patch: navigation buttons are re-enabled after patch commits', async ({ page }) => {
    await page.getByTestId('global-nav-about').click();

    // Wait for navigation to complete and the about page to appear
    await expect(page.getByTestId('page-about').first()).toBeVisible({ timeout: 7000 });

    // All navigation buttons must be re-enabled after the patch commits
    await expect(page.getByTestId('global-nav-home')).not.toBeDisabled();
    await expect(page.getByTestId('global-nav-about')).not.toBeDisabled();
    await expect(page.getByTestId('global-nav-contact')).not.toBeDisabled();

    // Button labels must be back to plain text (not '…' which shows during isPending)
    await expect(page.getByTestId('global-nav-home')).toHaveText('home');
    await expect(page.getByTestId('global-nav-about')).toHaveText('about');
    await expect(page.getByTestId('global-nav-contact')).toHaveText('contact');

    await page.screenshot({ path: 'test-results/ui-patch-global-nav-reenabled.png' });
  });

  test('local patch: navigation buttons are re-enabled after patch commits', async ({ page }) => {
    await page.getByTestId('local-nav-about').click();

    // Wait for navigation to complete and the about page to appear
    await expect(page.getByTestId('page-about').first()).toBeVisible({ timeout: 7000 });

    // Navigation buttons in the local patch nav must be re-enabled
    await expect(page.getByTestId('local-nav-home')).not.toBeDisabled();
    await expect(page.getByTestId('local-nav-about')).not.toBeDisabled();
    await expect(page.getByTestId('local-nav-contact')).not.toBeDisabled();

    // Labels back to plain text
    await expect(page.getByTestId('local-nav-home')).toHaveText('home');
    await expect(page.getByTestId('local-nav-about')).toHaveText('about');
    await expect(page.getByTestId('local-nav-contact')).toHaveText('contact');

    await page.screenshot({ path: 'test-results/ui-patch-local-nav-reenabled.png' });
  });

  test('clocks demo: renders all three clock variants', async ({ page }) => {
    await expect(page.getByTestId('clock-default').first()).toBeVisible();
    await expect(page.getByTestId('clock-live').first()).toBeVisible();
    await expect(page.getByTestId('clock-alternating').first()).toBeVisible();
    await page.screenshot({ path: 'test-results/ui-patch-clocks.png' });
  });

  test('clocks demo: clocks display a time string', async ({ page }) => {
    const clockEl = page.getByTestId('clock-default').first();
    await expect(clockEl).toBeVisible();
    const text = await clockEl.textContent();
    // toLocaleTimeString('en-US') produces e.g. "3:45:11 PM" or "12:34:56 PM"
    expect(text).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    await page.screenshot({ path: 'test-results/ui-patch-clock-time.png' });
  });

  test('global patch: navigates to about page after async delay', async ({ page }) => {
    await page.getByTestId('global-nav-about').click();

    // Navigation takes 5 s — use a generous timeout
    await expect(page.getByTestId('page-about').first()).toBeVisible({ timeout: 7000 });
    await page.screenshot({ path: 'test-results/ui-patch-about.png' });
  });

  test('global patch: DOM is frozen until patch commits', async ({ page }) => {
    await page.getByTestId('global-nav-about').click();

    // Immediately after click the home page must still be visible (DOM is frozen)
    await expect(page.getByTestId('page-home').first()).toBeVisible();

    // After the 5 s patch commits the about page replaces it
    await expect(page.getByTestId('page-about').first()).toBeVisible({ timeout: 7000 });
    await page.screenshot({ path: 'test-results/ui-patch-frozen-then-committed.png' });
  });

  test('global patch: shows navigation log entries after commit', async ({ page }) => {
    await page.getByTestId('global-nav-contact').click();

    // Both log entries are deferred — they appear together after the 5 s commit
    await expect(page.getByTestId('global-patch-log')).toContainText(
      '[global] navigating to contact',
      { timeout: 7000 },
    );
    await expect(page.getByTestId('global-patch-log')).toContainText(
      '[global] arrived at contact',
      { timeout: 7000 },
    );
    await page.screenshot({ path: 'test-results/ui-patch-log.png' });
  });

  test('local patch: home page is shown by default', async ({ page }) => {
    // The local patch demo also has HomePage/AboutPage/ContactPage
    await expect(page.getByTestId('page-home').nth(1)).toBeVisible();
  });

  test('local patch: navigates to contact page after async delay', async ({ page }) => {
    await page.getByTestId('local-nav-contact').click();

    await expect(page.getByTestId('page-contact').first()).toBeVisible({ timeout: 7000 });
    await page.screenshot({ path: 'test-results/ui-patch-local-contact.png' });
  });

  test('clocks tick every second and display valid time strings', async ({ page }) => {
    // After 1 s the clocks tick — verify all clock containers still show valid times
    await page.waitForTimeout(1100);
    for (const testId of ['clock-default', 'clock-live', 'clock-alternating']) {
      const text = await page
        .getByTestId(testId)
        .first()
        .locator('[data-testid="clock-time"]')
        .textContent();
      expect(text).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    }
    await page.screenshot({ path: 'test-results/ui-patch-clocks-ticked.png' });
  });

  // ── $patch="live" correctness tests ─────────────────────────────────────

  test('$patch="live" clock updates during a global patch while $patch="default" stays frozen', async ({
    page,
  }) => {
    // Start the 5 s global-patch navigation
    await page.getByTestId('global-nav-about').click();

    // Wait 1.5 s so a clock tick is guaranteed to have occurred while the patch
    // is still in progress (patch runs for 5 s total).
    await page.waitForTimeout(1500);

    // Snapshot both clocks at this mid-patch moment (first instance = global demo)
    const globalDemo = page.getByTestId('global-patch-demo');
    const liveBefore = await globalDemo
      .getByTestId('clock-live')
      .locator('[data-testid="clock-time"]')
      .textContent();
    const defaultBefore = await globalDemo
      .getByTestId('clock-default')
      .locator('[data-testid="clock-time"]')
      .textContent();

    // Wait another 1.5 s so another tick fires while the patch is still active
    await page.waitForTimeout(1500);

    const liveAfter = await globalDemo
      .getByTestId('clock-live')
      .locator('[data-testid="clock-time"]')
      .textContent();
    const defaultAfter = await globalDemo
      .getByTestId('clock-default')
      .locator('[data-testid="clock-time"]')
      .textContent();

    // The live clock MUST have changed — it is not frozen
    expect(liveAfter).not.toBe(liveBefore);

    // The default clock MUST remain frozen until the patch commits
    expect(defaultAfter).toBe(defaultBefore);

    await page.screenshot({ path: 'test-results/ui-patch-live-vs-default.png' });
  });

  test('$patch="live" clock updates during a local patch while $patch="default" stays frozen', async ({
    page,
  }) => {
    // Start the 5 s local-patch navigation
    await page.getByTestId('local-nav-about').click();

    // Wait 1.5 s — patch is still active
    await page.waitForTimeout(1500);

    // Use the Clocks instance inside LocalPatchDemo
    const localDemo = page.getByTestId('local-patch-demo');
    const liveBefore = await localDemo
      .getByTestId('clock-live')
      .locator('[data-testid="clock-time"]')
      .textContent();
    const defaultBefore = await localDemo
      .getByTestId('clock-default')
      .locator('[data-testid="clock-time"]')
      .textContent();

    await page.waitForTimeout(1500);

    const liveAfter = await localDemo
      .getByTestId('clock-live')
      .locator('[data-testid="clock-time"]')
      .textContent();
    const defaultAfter = await localDemo
      .getByTestId('clock-default')
      .locator('[data-testid="clock-time"]')
      .textContent();

    expect(liveAfter).not.toBe(liveBefore);
    expect(defaultAfter).toBe(defaultBefore);

    await page.screenshot({ path: 'test-results/ui-patch-local-live-vs-default.png' });
  });
});

// ---------------------------------------------------------------------------
// Visibility during patches
// ---------------------------------------------------------------------------

/** Helpers scoped to one of the two visibility demos. */
async function visibilitySetup(page: import('@playwright/test').Page, scope: 'gv' | 'lv') {
  const panel = page.locator(
    `[data-testid="${scope === 'gv' ? 'global' : 'local'}-visibility-demo"]`,
  );
  const startBtn = panel.locator(`[data-testid="${scope}-start-patch"]`);
  const commitBtn = panel.locator(`[data-testid="${scope}-commit-patch"]`);
  const toggleDefault = panel.locator(`[data-testid="${scope}-toggle-default"]`);
  const toggleLive = panel.locator(`[data-testid="${scope}-toggle-live"]`);
  const targetDefault = page.locator(`[data-testid="${scope}-target-default"]`);
  const targetLive = page.locator(`[data-testid="${scope}-target-live"]`);
  return { panel, startBtn, commitBtn, toggleDefault, toggleLive, targetDefault, targetLive };
}

test.describe('Visibility during global patch', () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await clickTab(page, 'UI Patch');
    await page.waitForSelector('[data-testid="global-visibility-demo"]');
  });

  test('default element stays visible when removed during patch, gone after commit', async ({
    page,
  }) => {
    const { startBtn, commitBtn, toggleDefault, targetDefault } = await visibilitySetup(page, 'gv');

    await expect(targetDefault).toBeAttached();

    await startBtn.click();
    await toggleDefault.click(); // remove — frozen
    await expect(targetDefault).toBeAttached(); // still visible

    await commitBtn.click();
    await expect(targetDefault).not.toBeAttached(); // gone after commit

    await page.screenshot({ path: 'test-results/gv-default-remove.png' });
  });

  test('$patch="live" element disappears immediately when removed during patch', async ({
    page,
  }) => {
    const { startBtn, commitBtn, toggleLive, targetLive } = await visibilitySetup(page, 'gv');

    await expect(targetLive).toBeAttached();

    await startBtn.click();
    await toggleLive.click(); // live-remove → gone immediately
    await expect(targetLive).not.toBeAttached();

    await commitBtn.click();
    await expect(targetLive).not.toBeAttached(); // still gone after commit

    await page.screenshot({ path: 'test-results/gv-live-remove.png' });
  });

  test('default element does not appear when added during patch, appears after commit', async ({
    page,
  }) => {
    const { startBtn, commitBtn, toggleDefault, targetDefault } = await visibilitySetup(page, 'gv');

    // Start with element hidden
    await toggleDefault.click(); // hide before patch
    await expect(targetDefault).not.toBeAttached();

    await startBtn.click();
    await toggleDefault.click(); // add — frozen
    await expect(targetDefault).not.toBeAttached(); // not yet visible

    await commitBtn.click();
    await expect(targetDefault).toBeAttached(); // appears after commit

    await page.screenshot({ path: 'test-results/gv-default-add.png' });
  });

  test('$patch="live" element appears immediately when added during patch', async ({ page }) => {
    const { startBtn, commitBtn, toggleLive, targetLive } = await visibilitySetup(page, 'gv');

    await toggleLive.click(); // hide before patch
    await expect(targetLive).not.toBeAttached();

    await startBtn.click();
    await toggleLive.click(); // live-add → appears immediately
    await expect(targetLive).toBeAttached();

    await commitBtn.click();
    await expect(targetLive).toBeAttached(); // still present after commit

    await page.screenshot({ path: 'test-results/gv-live-add.png' });
  });

  test('live element removed then re-added: disappears immediately and reappears immediately', async ({
    page,
  }) => {
    const { startBtn, commitBtn, toggleLive, targetLive } = await visibilitySetup(page, 'gv');

    await startBtn.click();
    await toggleLive.click(); // live-remove
    await expect(targetLive).not.toBeAttached();
    await toggleLive.click(); // live-re-add
    await expect(targetLive).toBeAttached();

    await commitBtn.click();
    await expect(targetLive).toBeAttached();

    await page.screenshot({ path: 'test-results/gv-live-remove-readd.png' });
  });

  test('default element removed then re-added: visible throughout, present after commit', async ({
    page,
  }) => {
    const { startBtn, commitBtn, toggleDefault, targetDefault } = await visibilitySetup(page, 'gv');

    await startBtn.click();
    await toggleDefault.click(); // frozen — still visible
    await expect(targetDefault).toBeAttached();
    await toggleDefault.click(); // re-add — still visible
    await expect(targetDefault).toBeAttached();

    await commitBtn.click();
    await expect(targetDefault).toBeAttached();
  });

  test('default element added then removed during patch: absent throughout and after commit', async ({
    page,
  }) => {
    const { startBtn, commitBtn, toggleDefault, targetDefault } = await visibilitySetup(page, 'gv');

    await toggleDefault.click(); // hide before patch
    await expect(targetDefault).not.toBeAttached();

    await startBtn.click();
    await toggleDefault.click(); // add (frozen — still absent)
    await expect(targetDefault).not.toBeAttached();
    await toggleDefault.click(); // remove again (frozen — still absent)
    await expect(targetDefault).not.toBeAttached();

    await commitBtn.click();
    await expect(targetDefault).not.toBeAttached(); // final state: hidden

    await page.screenshot({ path: 'test-results/gv-default-add-remove.png' });
  });

  test('live element added then removed: not present after commit', async ({ page }) => {
    const { startBtn, commitBtn, toggleLive, targetLive } = await visibilitySetup(page, 'gv');

    await toggleLive.click(); // hide before patch
    await startBtn.click();
    await toggleLive.click(); // live-add
    await expect(targetLive).toBeAttached();
    await toggleLive.click(); // live-remove
    await expect(targetLive).not.toBeAttached();

    await commitBtn.click();
    await expect(targetLive).not.toBeAttached();

    await page.screenshot({ path: 'test-results/gv-live-add-remove.png' });
  });
});

// ---------------------------------------------------------------------------
// Lazy context (useContext selector / transform) example
// ---------------------------------------------------------------------------

test.describe('Lazy context example', () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await clickTab(page, 'Lazy Context');
    await page.waitForSelector('[data-testid="lazy-ctx-demo"]');
  });

  // ── initial render ────────────────────────────────────────────────────────

  test('all three consumers render once on mount', async ({ page }) => {
    await expect(page.getByTestId('lazy-ctx-no-selector-renders')).toHaveText('1');
    await expect(page.getByTestId('lazy-ctx-selector-renders')).toHaveText('1');
    await expect(page.getByTestId('lazy-ctx-transform-renders')).toHaveText('1');
    await page.screenshot({ path: 'test-results/lazy-ctx-initial.png' });
  });

  test('initial name is Alice for overloads 1 and 2', async ({ page }) => {
    await expect(page.getByTestId('lazy-ctx-no-selector-name')).toHaveText('Alice');
    await expect(page.getByTestId('lazy-ctx-selector-name')).toHaveText('Alice');
  });

  test('initial transform value is ALICE (uppercased)', async ({ page }) => {
    await expect(page.getByTestId('lazy-ctx-transform-value')).toHaveText('ALICE');
  });

  // ── Bump count — only overload 1 should rerender ─────────────────────────

  test('bump count: only overload-1 consumer rerenders', async ({ page }) => {
    await page.getByTestId('lazy-ctx-bump-count').click();

    // Overload 1 must have rerendered (render count increased to 2)
    await expect(page.getByTestId('lazy-ctx-no-selector-renders')).toHaveText('2');

    // Overloads 2 and 3 must NOT have rerendered (still at 1)
    await expect(page.getByTestId('lazy-ctx-selector-renders')).toHaveText('1');
    await expect(page.getByTestId('lazy-ctx-transform-renders')).toHaveText('1');

    await page.screenshot({ path: 'test-results/lazy-ctx-bump-count.png' });
  });

  test('bump count multiple times: overload-2 and overload-3 stay at 1', async ({ page }) => {
    await page.getByTestId('lazy-ctx-bump-count').click();
    await page.getByTestId('lazy-ctx-bump-count').click();
    await page.getByTestId('lazy-ctx-bump-count').click();

    await expect(page.getByTestId('lazy-ctx-no-selector-renders')).toHaveText('4');
    await expect(page.getByTestId('lazy-ctx-selector-renders')).toHaveText('1');
    await expect(page.getByTestId('lazy-ctx-transform-renders')).toHaveText('1');
  });

  test('bump count: overload-1 shows updated count value', async ({ page }) => {
    await page.getByTestId('lazy-ctx-bump-count').click();
    await page.getByTestId('lazy-ctx-bump-count').click();

    await expect(page.getByTestId('lazy-ctx-no-selector-count-val')).toHaveText('2');
  });

  // ── Toggle role — only overload 1 should rerender ────────────────────────

  test('toggle role: only overload-1 consumer rerenders', async ({ page }) => {
    await page.getByTestId('lazy-ctx-change-role').click();

    await expect(page.getByTestId('lazy-ctx-no-selector-renders')).toHaveText('2');
    await expect(page.getByTestId('lazy-ctx-selector-renders')).toHaveText('1');
    await expect(page.getByTestId('lazy-ctx-transform-renders')).toHaveText('1');

    await page.screenshot({ path: 'test-results/lazy-ctx-toggle-role.png' });
  });

  // ── Toggle name — all three consumers should rerender ────────────────────

  test('toggle name: all three consumers rerender', async ({ page }) => {
    await page.getByTestId('lazy-ctx-change-name').click();

    await expect(page.getByTestId('lazy-ctx-no-selector-renders')).toHaveText('2');
    await expect(page.getByTestId('lazy-ctx-selector-renders')).toHaveText('2');
    await expect(page.getByTestId('lazy-ctx-transform-renders')).toHaveText('2');

    await page.screenshot({ path: 'test-results/lazy-ctx-toggle-name.png' });
  });

  test('toggle name: overload-1 and overload-2 show updated name', async ({ page }) => {
    await page.getByTestId('lazy-ctx-change-name').click();

    await expect(page.getByTestId('lazy-ctx-no-selector-name')).toHaveText('Bob');
    await expect(page.getByTestId('lazy-ctx-selector-name')).toHaveText('Bob');
  });

  test('toggle name: overload-3 transform value updates to BOB', async ({ page }) => {
    await page.getByTestId('lazy-ctx-change-name').click();

    await expect(page.getByTestId('lazy-ctx-transform-value')).toHaveText('BOB');
  });

  test('toggle name twice: all consumers back to render count 3, name Alice, transform ALICE', async ({
    page,
  }) => {
    await page.getByTestId('lazy-ctx-change-name').click();
    await page.getByTestId('lazy-ctx-change-name').click();

    await expect(page.getByTestId('lazy-ctx-no-selector-renders')).toHaveText('3');
    await expect(page.getByTestId('lazy-ctx-selector-renders')).toHaveText('3');
    await expect(page.getByTestId('lazy-ctx-transform-renders')).toHaveText('3');

    await expect(page.getByTestId('lazy-ctx-no-selector-name')).toHaveText('Alice');
    await expect(page.getByTestId('lazy-ctx-transform-value')).toHaveText('ALICE');
  });

  // ── Mixed sequence ────────────────────────────────────────────────────────

  test('mixed: bump then toggle name — correct render counts', async ({ page }) => {
    // bump: +1 to overload-1 only → [2, 1, 1]
    await page.getByTestId('lazy-ctx-bump-count').click();
    // toggle name: +1 to all → [3, 2, 2]
    await page.getByTestId('lazy-ctx-change-name').click();
    // bump again: +1 to overload-1 only → [4, 2, 2]
    await page.getByTestId('lazy-ctx-bump-count').click();

    await expect(page.getByTestId('lazy-ctx-no-selector-renders')).toHaveText('4');
    await expect(page.getByTestId('lazy-ctx-selector-renders')).toHaveText('2');
    await expect(page.getByTestId('lazy-ctx-transform-renders')).toHaveText('2');

    await page.screenshot({ path: 'test-results/lazy-ctx-mixed.png' });
  });

  test('overload-2 selector hook state preserved: count shown by selector consumer matches overload-1', async ({
    page,
  }) => {
    // bump count 3 times — overload-2 does NOT rerender, so it shows stale count.
    // This is expected: selector consumer skips rerender, thus its displayed
    // count value is from the last time it rendered (mount = 0).
    await page.getByTestId('lazy-ctx-bump-count').click();
    await page.getByTestId('lazy-ctx-bump-count').click();
    await page.getByTestId('lazy-ctx-bump-count').click();

    // Overload 1 sees the latest count (3)
    await expect(page.getByTestId('lazy-ctx-no-selector-count-val')).toHaveText('3');
    // Overload 2 last rendered at mount (count was 0) and has not rerendered
    await expect(page.getByTestId('lazy-ctx-selector-count-val')).toHaveText('0');
  });
});

// ---------------------------------------------------------------------------
// AbortSignal Effect example
// ---------------------------------------------------------------------------

test.describe('AbortSignal Effect example', () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await clickTab(page, 'AbortSignal Effect');
    await page.waitForSelector('[data-testid="abort-signal-demo"]');
  });

  test('renders all three signal rows on mount', async ({ page }) => {
    await expect(page.getByTestId('signal-row-1')).toBeVisible();
    await expect(page.getByTestId('signal-row-2')).toBeVisible();
    await expect(page.getByTestId('signal-row-3')).toBeVisible();
    await page.screenshot({ path: 'test-results/abort-signal-initial.png' });
  });

  test('user 1 is active and polling by default', async ({ page }) => {
    await page.waitForTimeout(500);
    await expect(page.getByTestId('row-status-1')).toContainText('fetched');
    // Users 2 and 3 should be inactive
    await expect(page.getByTestId('row-status-2')).toHaveText('inactive');
    await expect(page.getByTestId('row-status-3')).toHaveText('inactive');
    await page.screenshot({ path: 'test-results/abort-signal-polling.png' });
  });

  test('switching to user 2 increments user 1 abort count and starts polling user 2', async ({
    page,
  }) => {
    // Let user 1 poll a bit
    await page.waitForTimeout(500);

    // Switch to user 2
    await page.getByTestId('user-btn-2').click();

    // Wait for the effect to fire and the abort to propagate
    await page.waitForTimeout(600);

    // User 1's abort count should have increased
    await expect(page.getByTestId('row-abort-count-1')).toHaveText('1');
    // status is "inactive" because the effect re-runs with new activeId
    await expect(page.getByTestId('row-status-1')).toHaveText('inactive');

    // User 2 should be polling with 0 aborts
    await expect(page.getByTestId('row-status-2')).toContainText('fetched');
    await expect(page.getByTestId('row-abort-count-2')).toHaveText('0');

    await page.screenshot({ path: 'test-results/abort-signal-user-change.png' });
  });

  test('switching from user 2 to user 3 increments user 2 abort count', async ({ page }) => {
    await page.getByTestId('user-btn-2').click();
    await page.waitForTimeout(500);

    await page.getByTestId('user-btn-3').click();
    await page.waitForTimeout(600);

    // User 2's abort count should have increased
    await expect(page.getByTestId('row-abort-count-2')).toHaveText('1');
    // status is "inactive" because the effect re-runs with new activeId
    await expect(page.getByTestId('row-status-2')).toHaveText('inactive');

    // User 3 should be polling
    await expect(page.getByTestId('row-status-3')).toContainText('fetched');
    await expect(page.getByTestId('row-abort-count-3')).toHaveText('0');

    await page.screenshot({ path: 'test-results/abort-signal-switch-2-to-3.png' });
  });

  test('unmounting the panel aborts all active signals', async ({ page }) => {
    await page.waitForTimeout(500);

    // Unmount the panel
    await page.getByTestId('toggle-panel').uncheck();
    await expect(page.getByTestId('signal-table')).not.toBeAttached();
    await page.screenshot({ path: 'test-results/abort-signal-unmounted.png' });
  });

  test('remounting the panel starts fresh with user 1 polling', async ({ page }) => {
    // Unmount
    await page.getByTestId('toggle-panel').uncheck();
    await expect(page.getByTestId('signal-table')).not.toBeAttached();

    // Remount
    await page.getByTestId('toggle-panel').check();
    await expect(page.getByTestId('signal-table')).toBeVisible();

    await page.waitForTimeout(500);
    await expect(page.getByTestId('row-status-1')).toContainText('fetched');
    await page.screenshot({ path: 'test-results/abort-signal-remounted.png' });
  });

  test('rapid switches: only the final user polls, others show aborted', async ({ page }) => {
    await page.getByTestId('user-btn-2').click();
    await page.getByTestId('user-btn-3').click();
    await page.getByTestId('user-btn-1').click();

    await page.waitForTimeout(600);

    // User 1 should be polling again (abort count accumulated from previous switches)
    await expect(page.getByTestId('row-status-1')).toContainText('fetched');
    await expect(page.getByTestId('row-abort-count-1')).toHaveText('1');

    await page.screenshot({ path: 'test-results/abort-signal-rapid-change.png' });
  });
});

test.describe('Visibility during local patch', () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await clickTab(page, 'UI Patch');
    await page.waitForSelector('[data-testid="local-visibility-demo"]');
  });

  test('default element stays visible when removed during local patch, gone after commit', async ({
    page,
  }) => {
    const { startBtn, commitBtn, toggleDefault, targetDefault } = await visibilitySetup(page, 'lv');

    await expect(targetDefault).toBeAttached();

    await startBtn.click();
    await toggleDefault.click();
    await expect(targetDefault).toBeAttached(); // frozen

    await commitBtn.click();
    await expect(targetDefault).not.toBeAttached();

    await page.screenshot({ path: 'test-results/lv-default-remove.png' });
  });

  test('$patch="live" element disappears immediately during local patch', async ({ page }) => {
    const { startBtn, commitBtn, toggleLive, targetLive } = await visibilitySetup(page, 'lv');

    await startBtn.click();
    await toggleLive.click();
    await expect(targetLive).not.toBeAttached(); // live-remove: immediate

    await commitBtn.click();
    await expect(targetLive).not.toBeAttached();

    await page.screenshot({ path: 'test-results/lv-live-remove.png' });
  });

  test('default element does not appear during local patch, appears after commit', async ({
    page,
  }) => {
    const { startBtn, commitBtn, toggleDefault, targetDefault } = await visibilitySetup(page, 'lv');

    await toggleDefault.click(); // hide before patch
    await startBtn.click();
    await toggleDefault.click(); // frozen
    await expect(targetDefault).not.toBeAttached();

    await commitBtn.click();
    await expect(targetDefault).toBeAttached();

    await page.screenshot({ path: 'test-results/lv-default-add.png' });
  });

  test('$patch="live" element appears immediately during local patch', async ({ page }) => {
    const { startBtn, commitBtn, toggleLive, targetLive } = await visibilitySetup(page, 'lv');

    await toggleLive.click(); // hide before patch
    await startBtn.click();
    await toggleLive.click(); // live-add
    await expect(targetLive).toBeAttached();

    await commitBtn.click();
    await expect(targetLive).toBeAttached();

    await page.screenshot({ path: 'test-results/lv-live-add.png' });
  });

  test('live element removed then re-added during local patch: correct immediate and final state', async ({
    page,
  }) => {
    const { startBtn, commitBtn, toggleLive, targetLive } = await visibilitySetup(page, 'lv');

    await startBtn.click();
    await toggleLive.click(); // live-remove
    await expect(targetLive).not.toBeAttached();
    await toggleLive.click(); // live-re-add
    await expect(targetLive).toBeAttached();

    await commitBtn.click();
    await expect(targetLive).toBeAttached();
  });

  test('default element removed then re-added: visible throughout, present after commit', async ({
    page,
  }) => {
    const { startBtn, commitBtn, toggleDefault, targetDefault } = await visibilitySetup(page, 'lv');

    await startBtn.click();
    await toggleDefault.click(); // frozen: still visible
    await expect(targetDefault).toBeAttached();
    await toggleDefault.click(); // frozen: still visible
    await expect(targetDefault).toBeAttached();

    await commitBtn.click();
    await expect(targetDefault).toBeAttached();
  });
});

// ---------------------------------------------------------------------------
// Context Scoping demo
// ---------------------------------------------------------------------------

test.describe('Context Scoping demo', () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await clickTab(page, 'Context Scoping');
    await page.waitForSelector('[data-testid="independent-panel"]');
  });

  // ── 1. Two independent contexts ─────────────────────────────────────────

  test('shows initial theme and locale in independent panel', async ({ page }) => {
    await expect(page.getByTestId('theme-badge')).toHaveText('light');
    await expect(page.getByTestId('locale-badge')).toHaveText('en');
    await expect(page.getByTestId('both-badge')).toHaveText('light/en');
    await page.screenshot({ path: 'test-results/context-initial.png' });
  });

  test('toggling theme does not change locale', async ({ page }) => {
    await page.getByTestId('toggle-theme-btn').click();
    await expect(page.getByTestId('theme-badge')).toHaveText('dark');
    await expect(page.getByTestId('locale-badge')).toHaveText('en');
    await expect(page.getByTestId('both-badge')).toHaveText('dark/en');
    await page.screenshot({ path: 'test-results/context-theme-toggled.png' });
  });

  test('toggling locale does not change theme', async ({ page }) => {
    await page.getByTestId('toggle-locale-btn').click();
    await expect(page.getByTestId('locale-badge')).toHaveText('fi');
    await expect(page.getByTestId('theme-badge')).toHaveText('light');
    await expect(page.getByTestId('both-badge')).toHaveText('light/fi');
    await page.screenshot({ path: 'test-results/context-locale-toggled.png' });
  });

  test('toggling both contexts updates the combined badge', async ({ page }) => {
    await page.getByTestId('toggle-theme-btn').click();
    await page.getByTestId('toggle-locale-btn').click();
    await expect(page.getByTestId('both-badge')).toHaveText('dark/fi');
    await page.screenshot({ path: 'test-results/context-both-toggled.png' });
  });

  // ── 2. Nested Provider override ─────────────────────────────────────────

  test('inner card always shows dark even when outer theme is light', async ({ page }) => {
    await expect(page.getByTestId('outer-theme-badge')).toHaveText('light');
    await expect(page.getByTestId('inner-theme-badge')).toHaveText('dark');
    await page.screenshot({ path: 'test-results/context-nested-initial.png' });
  });

  test('inner card stays dark after outer theme toggles to dark', async ({ page }) => {
    await page.getByTestId('toggle-theme-btn').click();
    await expect(page.getByTestId('outer-theme-badge')).toHaveText('dark');
    await expect(page.getByTestId('inner-theme-badge')).toHaveText('dark');
    await page.screenshot({ path: 'test-results/context-nested-outer-dark.png' });
  });

  test('inner card stays dark after outer theme toggles back to light', async ({ page }) => {
    await page.getByTestId('toggle-theme-btn').click(); // → dark
    await page.getByTestId('toggle-theme-btn').click(); // → light again
    await expect(page.getByTestId('inner-theme-badge')).toHaveText('dark');
  });

  // ── 3. State preserved across context updates ───────────────────────────

  test('consumer state is preserved when context value changes', async ({ page }) => {
    // Increment the counter three times
    await page.getByTestId('stateful-inc').click();
    await page.getByTestId('stateful-inc').click();
    await page.getByTestId('stateful-inc').click();
    await expect(page.getByTestId('stateful-count')).toHaveText('3');

    // Toggle the outer theme – this changes the context value flowing into the consumer
    await page.getByTestId('toggle-theme-btn').click();

    // Consumer must reflect the new theme…
    await expect(page.getByTestId('stateful-theme')).toHaveText('dark');
    // …but the counter state must be preserved (not reset to 0)
    await expect(page.getByTestId('stateful-count')).toHaveText('3');
    await page.screenshot({ path: 'test-results/context-state-preserved.png' });
  });

  // ── 4. Sibling providers are isolated ───────────────────────────────────

  test('sibling providers start with independent values', async ({ page }) => {
    await expect(page.getByTestId('sibling-a')).toHaveText('light');
    await expect(page.getByTestId('sibling-b')).toHaveText('dark');
    await page.screenshot({ path: 'test-results/context-siblings-initial.png' });
  });

  test('toggling sibling A does not affect sibling B', async ({ page }) => {
    await page.getByTestId('toggle-sibling-a').click();
    await expect(page.getByTestId('sibling-a')).toHaveText('dark');
    await expect(page.getByTestId('sibling-b')).toHaveText('dark');
    await page.screenshot({ path: 'test-results/context-sibling-a-toggled.png' });
  });

  test('toggling sibling B does not affect sibling A', async ({ page }) => {
    await page.getByTestId('toggle-sibling-b').click();
    await expect(page.getByTestId('sibling-a')).toHaveText('light');
    await expect(page.getByTestId('sibling-b')).toHaveText('light');
    await page.screenshot({ path: 'test-results/context-sibling-b-toggled.png' });
  });

  test('both sibling providers can be toggled independently', async ({ page }) => {
    await page.getByTestId('toggle-sibling-a').click();
    await page.getByTestId('toggle-sibling-b').click();
    await expect(page.getByTestId('sibling-a')).toHaveText('dark');
    await expect(page.getByTestId('sibling-b')).toHaveText('light');
    await page.screenshot({ path: 'test-results/context-siblings-both-toggled.png' });
  });
});
