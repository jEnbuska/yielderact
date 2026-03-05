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
    const label = page.locator(`label[for="${inputId}"]`);
    await expect(label).toBeVisible();
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
    // Wait for the Global patch section heading to appear
    await page.waitForSelector('text=Global patch');
  });

  test('renders both global and local patch sections', async ({ page }) => {
    await expect(page.locator('text=Global patch — entire tree frozen')).toBeVisible();
    await expect(page.locator('text=Local patch — only this subtree frozen')).toBeVisible();
    await page.screenshot({ path: 'test-results/ui-patch-initial.png' });
  });

  test('global patch: home page is shown by default', async ({ page }) => {
    await expect(page.locator('text=🏠 Home').first()).toBeVisible();
    await page.screenshot({ path: 'test-results/ui-patch-home.png' });
  });

  test('clocks demo: renders all three clock variants', async ({ page }) => {
    await expect(page.locator('code', { hasText: '$patch="default"' }).first()).toBeVisible();
    await expect(page.locator('code', { hasText: '$patch="live"' }).first()).toBeVisible();
    await page.screenshot({ path: 'test-results/ui-patch-clocks.png' });
  });

  test('clocks demo: clocks display a time string', async ({ page }) => {
    // All three clock containers should show a non-empty time string in <b>
    await expect(page.locator('[data-testid="clock-default"] b').first()).toBeVisible();
    const text = await page.locator('[data-testid="clock-default"] b').first().textContent();
    // toLocaleTimeString('en-US') produces e.g. "3:45:11 PM" or "12:34:56 PM"
    expect(text).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    await page.screenshot({ path: 'test-results/ui-patch-clock-time.png' });
  });

  test('global patch: navigates to about page after async delay', async ({ page }) => {
    const aboutBtn = page.locator('nav button', { hasText: 'about' }).first();
    await aboutBtn.click();

    // Navigation takes 5 s — use a generous timeout
    await expect(page.locator('text=ℹ️ About').first()).toBeVisible({ timeout: 7000 });
    await page.screenshot({ path: 'test-results/ui-patch-about.png' });
  });

  test('global patch: DOM is frozen until patch commits', async ({ page }) => {
    const aboutBtn = page.locator('nav button', { hasText: 'about' }).first();
    await aboutBtn.click();

    // Immediately after click the home page must still be visible (DOM is frozen)
    await expect(page.locator('text=🏠 Home').first()).toBeVisible();

    // After the 5 s patch commits the about page replaces it
    await expect(page.locator('text=ℹ️ About').first()).toBeVisible({ timeout: 7000 });
    await page.screenshot({ path: 'test-results/ui-patch-frozen-then-committed.png' });
  });

  test('global patch: shows navigation log entries after commit', async ({ page }) => {
    const contactBtn = page.locator('nav button', { hasText: 'contact' }).first();
    await contactBtn.click();

    // Both log entries are deferred — they appear together after the 5 s commit
    await expect(page.locator('pre').first()).toContainText('[global] navigating to contact', {
      timeout: 7000,
    });
    await expect(page.locator('pre').first()).toContainText('[global] arrived at contact', {
      timeout: 7000,
    });
    await page.screenshot({ path: 'test-results/ui-patch-log.png' });
  });

  test('local patch: home page is shown by default', async ({ page }) => {
    // There are two nav bars; the second belongs to the local patch demo
    await expect(page.locator('text=🏠 Home').nth(1)).toBeVisible();
  });

  test('local patch: navigates to contact page after async delay', async ({ page }) => {
    const contactBtn = page.locator('nav button', { hasText: 'contact' }).nth(1);
    await contactBtn.click();

    await expect(page.locator('text=📬 Contact').first()).toBeVisible({ timeout: 7000 });
    await page.screenshot({ path: 'test-results/ui-patch-local-contact.png' });
  });

  test('clocks tick every second and display valid time strings', async ({ page }) => {
    // After 1 s the clocks tick — verify all clock containers still show valid times
    await page.waitForTimeout(1100);
    for (const testId of ['clock-default', 'clock-live', 'clock-alternating']) {
      const text = await page.locator(`[data-testid="${testId}"] b`).first().textContent();
      expect(text).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    }
    await page.screenshot({ path: 'test-results/ui-patch-clocks-ticked.png' });
  });

  // ── $patch="live" correctness tests ─────────────────────────────────────

  test('$patch="live" clock updates during a global patch while $patch="default" stays frozen', async ({
    page,
  }) => {
    // Start the 5 s global-patch navigation
    await page.locator('nav button', { hasText: 'about' }).first().click();

    // Wait 1.5 s so a clock tick is guaranteed to have occurred while the patch
    // is still in progress (patch runs for 5 s total).
    await page.waitForTimeout(1500);

    // Snapshot both clocks at this mid-patch moment
    const liveBefore = await page.locator('[data-testid="clock-live"] b').first().textContent();
    const defaultBefore = await page
      .locator('[data-testid="clock-default"] b')
      .first()
      .textContent();

    // Wait another 1.5 s so another tick fires while the patch is still active
    await page.waitForTimeout(1500);

    const liveAfter = await page.locator('[data-testid="clock-live"] b').first().textContent();
    const defaultAfter = await page
      .locator('[data-testid="clock-default"] b')
      .first()
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
    // Start the 5 s local-patch navigation (second nav bar)
    await page.locator('nav button', { hasText: 'about' }).nth(1).click();

    // Wait 1.5 s — patch is still active
    await page.waitForTimeout(1500);

    // Use the second Clocks instance (inside LocalPatchDemo)
    const liveBefore = await page.locator('[data-testid="clock-live"] b').nth(1).textContent();
    const defaultBefore = await page
      .locator('[data-testid="clock-default"] b')
      .nth(1)
      .textContent();

    await page.waitForTimeout(1500);

    const liveAfter = await page.locator('[data-testid="clock-live"] b').nth(1).textContent();
    const defaultAfter = await page.locator('[data-testid="clock-default"] b').nth(1).textContent();

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
