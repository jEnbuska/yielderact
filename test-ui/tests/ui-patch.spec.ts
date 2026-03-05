import { test, expect, type Page } from '@playwright/test';
import { goToTab } from './helpers';

async function goToUIPatch(page: Page) {
  await goToTab(page, 'UI Patch');
  await page.waitForSelector('[data-testid="patch-mode-global"]');
}

async function setMode(page: Page, mode: 'global' | 'local') {
  await page.getByTestId(`patch-mode-${mode}`).click();
}

async function visibilitySetup(page: Page, scope: 'gv' | 'lv') {
  const panel = page.locator(`[data-testid="${scope}-visibility-demo"]`);
  return {
    panel,
    startBtn: panel.locator(`[data-testid="${scope}-start-patch"]`),
    commitBtn: panel.locator(`[data-testid="${scope}-commit-patch"]`),
    toggleDefault: panel.locator(`[data-testid="${scope}-toggle-default"]`),
    toggleLive: panel.locator(`[data-testid="${scope}-toggle-live"]`),
    targetDefault: page.locator(`[data-testid="${scope}-target-default"]`),
    targetLive: page.locator(`[data-testid="${scope}-target-live"]`),
  };
}

// ---------------------------------------------------------------------------
// Basic rendering
// ---------------------------------------------------------------------------

test.describe('UI Patch example', () => {
  test.beforeEach(async ({ page }) => {
    await goToUIPatch(page);
  });

  test('renders mode toggle and navigation/visibility sections', async ({ page }) => {
    await expect(page.getByTestId('patch-mode-global')).toBeVisible();
    await expect(page.getByTestId('patch-mode-local')).toBeVisible();
    await expect(page.locator('text=Navigation')).toBeVisible();
    await page.screenshot({ path: 'test-results/ui-patch-initial.png' });
  });

  test('home page is shown by default', async ({ page }) => {
    await expect(page.locator('text=🏠 Home')).toBeVisible();
    await page.screenshot({ path: 'test-results/ui-patch-home.png' });
  });

  test('clocks display a time string', async ({ page }) => {
    const text = await page.locator('[data-testid="clock-default"] b').textContent();
    expect(text).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    await page.screenshot({ path: 'test-results/ui-patch-clock-time.png' });
  });

  test('clocks tick every second and display valid time strings', async ({ page }) => {
    await page.waitForTimeout(1100);
    for (const testId of ['clock-default', 'clock-live', 'clock-alternating']) {
      const text = await page.locator(`[data-testid="${testId}"] b`).textContent();
      expect(text).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    }
    await page.screenshot({ path: 'test-results/ui-patch-clocks-ticked.png' });
  });
});

// ---------------------------------------------------------------------------
// Global patch — navigation
// ---------------------------------------------------------------------------

test.describe('UI Patch — global patch navigation', () => {
  test.beforeEach(async ({ page }) => {
    await goToUIPatch(page);
    // default mode is global
  });

  test('navigates to about page after async delay', async ({ page }) => {
    await page.locator('nav button', { hasText: 'about' }).click();
    await expect(page.locator('text=ℹ️ About')).toBeVisible({ timeout: 7000 });
    await page.screenshot({ path: 'test-results/ui-patch-about.png' });
  });

  test('DOM is frozen until patch commits', async ({ page }) => {
    await page.locator('nav button', { hasText: 'about' }).click();
    await expect(page.locator('text=🏠 Home')).toBeVisible(); // still frozen
    await expect(page.locator('text=ℹ️ About')).toBeVisible({ timeout: 7000 });
    await page.screenshot({ path: 'test-results/ui-patch-frozen-then-committed.png' });
  });

  test('shows navigation log entries after commit', async ({ page }) => {
    await page.locator('nav button', { hasText: 'contact' }).click();
    await expect(page.locator('pre')).toContainText('navigating to contact', { timeout: 7000 });
    await expect(page.locator('pre')).toContainText('arrived at contact', { timeout: 7000 });
    await page.screenshot({ path: 'test-results/ui-patch-log.png' });
  });

  test('$patch="live" clock updates during global patch while $patch="default" stays frozen', async ({
    page,
  }) => {
    await page.locator('nav button', { hasText: 'about' }).click();
    await page.waitForTimeout(1500);

    const liveBefore = await page.locator('[data-testid="clock-live"] b').textContent();
    const defaultBefore = await page.locator('[data-testid="clock-default"] b').textContent();

    await page.waitForTimeout(1500);

    const liveAfter = await page.locator('[data-testid="clock-live"] b').textContent();
    const defaultAfter = await page.locator('[data-testid="clock-default"] b').textContent();

    expect(liveAfter).not.toBe(liveBefore);
    expect(defaultAfter).toBe(defaultBefore);
    await page.screenshot({ path: 'test-results/ui-patch-live-vs-default.png' });
  });
});

// ---------------------------------------------------------------------------
// Local patch — navigation
// ---------------------------------------------------------------------------

test.describe('UI Patch — local patch navigation', () => {
  test.beforeEach(async ({ page }) => {
    await goToUIPatch(page);
    await setMode(page, 'local');
  });

  test('home page is shown by default', async ({ page }) => {
    await expect(page.locator('text=🏠 Home')).toBeVisible();
  });

  test('navigates to contact page after async delay', async ({ page }) => {
    await page.locator('nav button', { hasText: 'contact' }).click();
    await expect(page.locator('text=📬 Contact')).toBeVisible({ timeout: 7000 });
    await page.screenshot({ path: 'test-results/ui-patch-local-contact.png' });
  });

  test('$patch="live" clock updates during local patch while $patch="default" stays frozen', async ({
    page,
  }) => {
    await page.locator('nav button', { hasText: 'about' }).click();
    await page.waitForTimeout(1500);

    const liveBefore = await page.locator('[data-testid="clock-live"] b').textContent();
    const defaultBefore = await page.locator('[data-testid="clock-default"] b').textContent();

    await page.waitForTimeout(1500);

    const liveAfter = await page.locator('[data-testid="clock-live"] b').textContent();
    const defaultAfter = await page.locator('[data-testid="clock-default"] b').textContent();

    expect(liveAfter).not.toBe(liveBefore);
    expect(defaultAfter).toBe(defaultBefore);
    await page.screenshot({ path: 'test-results/ui-patch-local-live-vs-default.png' });
  });
});

// ---------------------------------------------------------------------------
// Visibility during global patch
// ---------------------------------------------------------------------------

test.describe('Visibility during global patch', () => {
  test.beforeEach(async ({ page }) => {
    await goToUIPatch(page);
    // default mode is global — testids use 'gv' prefix
    await page.waitForSelector('[data-testid="gv-visibility-demo"]');
  });

  test('default element stays visible when removed during patch, gone after commit', async ({
    page,
  }) => {
    const l = await visibilitySetup(page, 'gv');
    await expect(l.targetDefault).toBeAttached();
    await l.startBtn.click();
    await l.toggleDefault.click();
    await expect(l.targetDefault).toBeAttached(); // frozen
    await l.commitBtn.click();
    await expect(l.targetDefault).not.toBeAttached();
    await page.screenshot({ path: 'test-results/gv-default-remove.png' });
  });

  test('$patch="live" element disappears immediately when removed during patch', async ({
    page,
  }) => {
    const l = await visibilitySetup(page, 'gv');
    await l.startBtn.click();
    await l.toggleLive.click();
    await expect(l.targetLive).not.toBeAttached();
    await l.commitBtn.click();
    await expect(l.targetLive).not.toBeAttached();
    await page.screenshot({ path: 'test-results/gv-live-remove.png' });
  });

  test('default element does not appear when added during patch, appears after commit', async ({
    page,
  }) => {
    const l = await visibilitySetup(page, 'gv');
    await l.toggleDefault.click(); // hide before patch
    await l.startBtn.click();
    await l.toggleDefault.click(); // add — frozen
    await expect(l.targetDefault).not.toBeAttached();
    await l.commitBtn.click();
    await expect(l.targetDefault).toBeAttached();
    await page.screenshot({ path: 'test-results/gv-default-add.png' });
  });

  test('$patch="live" element appears immediately when added during patch', async ({ page }) => {
    const l = await visibilitySetup(page, 'gv');
    await l.toggleLive.click(); // hide before patch
    await l.startBtn.click();
    await l.toggleLive.click(); // live-add
    await expect(l.targetLive).toBeAttached();
    await l.commitBtn.click();
    await expect(l.targetLive).toBeAttached();
    await page.screenshot({ path: 'test-results/gv-live-add.png' });
  });

  test('live element removed then re-added: disappears and reappears immediately', async ({
    page,
  }) => {
    const l = await visibilitySetup(page, 'gv');
    await l.startBtn.click();
    await l.toggleLive.click();
    await expect(l.targetLive).not.toBeAttached();
    await l.toggleLive.click();
    await expect(l.targetLive).toBeAttached();
    await l.commitBtn.click();
    await expect(l.targetLive).toBeAttached();
    await page.screenshot({ path: 'test-results/gv-live-remove-readd.png' });
  });

  test('default element removed then re-added: visible throughout, present after commit', async ({
    page,
  }) => {
    const l = await visibilitySetup(page, 'gv');
    await l.startBtn.click();
    await l.toggleDefault.click();
    await expect(l.targetDefault).toBeAttached();
    await l.toggleDefault.click();
    await expect(l.targetDefault).toBeAttached();
    await l.commitBtn.click();
    await expect(l.targetDefault).toBeAttached();
  });

  test('default element added then removed during patch: absent throughout and after commit', async ({
    page,
  }) => {
    const l = await visibilitySetup(page, 'gv');
    await l.toggleDefault.click(); // hide
    await l.startBtn.click();
    await l.toggleDefault.click(); // add (frozen)
    await expect(l.targetDefault).not.toBeAttached();
    await l.toggleDefault.click(); // remove (frozen)
    await expect(l.targetDefault).not.toBeAttached();
    await l.commitBtn.click();
    await expect(l.targetDefault).not.toBeAttached();
    await page.screenshot({ path: 'test-results/gv-default-add-remove.png' });
  });

  test('live element added then removed: not present after commit', async ({ page }) => {
    const l = await visibilitySetup(page, 'gv');
    await l.toggleLive.click(); // hide
    await l.startBtn.click();
    await l.toggleLive.click(); // live-add
    await expect(l.targetLive).toBeAttached();
    await l.toggleLive.click(); // live-remove
    await expect(l.targetLive).not.toBeAttached();
    await l.commitBtn.click();
    await expect(l.targetLive).not.toBeAttached();
    await page.screenshot({ path: 'test-results/gv-live-add-remove.png' });
  });
});

// ---------------------------------------------------------------------------
// Visibility during local patch
// ---------------------------------------------------------------------------

test.describe('Visibility during local patch', () => {
  test.beforeEach(async ({ page }) => {
    await goToUIPatch(page);
    await setMode(page, 'local');
    await page.waitForSelector('[data-testid="lv-visibility-demo"]');
  });

  test('default element stays visible when removed during local patch, gone after commit', async ({
    page,
  }) => {
    const l = await visibilitySetup(page, 'lv');
    await expect(l.targetDefault).toBeAttached();
    await l.startBtn.click();
    await l.toggleDefault.click();
    await expect(l.targetDefault).toBeAttached(); // frozen
    await l.commitBtn.click();
    await expect(l.targetDefault).not.toBeAttached();
    await page.screenshot({ path: 'test-results/lv-default-remove.png' });
  });

  test('$patch="live" element disappears immediately during local patch', async ({ page }) => {
    const l = await visibilitySetup(page, 'lv');
    await l.startBtn.click();
    await l.toggleLive.click();
    await expect(l.targetLive).not.toBeAttached();
    await l.commitBtn.click();
    await expect(l.targetLive).not.toBeAttached();
    await page.screenshot({ path: 'test-results/lv-live-remove.png' });
  });

  test('default element does not appear during local patch, appears after commit', async ({
    page,
  }) => {
    const l = await visibilitySetup(page, 'lv');
    await l.toggleDefault.click(); // hide
    await l.startBtn.click();
    await l.toggleDefault.click(); // frozen
    await expect(l.targetDefault).not.toBeAttached();
    await l.commitBtn.click();
    await expect(l.targetDefault).toBeAttached();
    await page.screenshot({ path: 'test-results/lv-default-add.png' });
  });

  test('$patch="live" element appears immediately during local patch', async ({ page }) => {
    const l = await visibilitySetup(page, 'lv');
    await l.toggleLive.click(); // hide
    await l.startBtn.click();
    await l.toggleLive.click(); // live-add
    await expect(l.targetLive).toBeAttached();
    await l.commitBtn.click();
    await expect(l.targetLive).toBeAttached();
    await page.screenshot({ path: 'test-results/lv-live-add.png' });
  });

  test('live element removed then re-added: correct immediate and final state', async ({
    page,
  }) => {
    const l = await visibilitySetup(page, 'lv');
    await l.startBtn.click();
    await l.toggleLive.click();
    await expect(l.targetLive).not.toBeAttached();
    await l.toggleLive.click();
    await expect(l.targetLive).toBeAttached();
    await l.commitBtn.click();
    await expect(l.targetLive).toBeAttached();
  });

  test('default element removed then re-added: visible throughout, present after commit', async ({
    page,
  }) => {
    const l = await visibilitySetup(page, 'lv');
    await l.startBtn.click();
    await l.toggleDefault.click();
    await expect(l.targetDefault).toBeAttached();
    await l.toggleDefault.click();
    await expect(l.targetDefault).toBeAttached();
    await l.commitBtn.click();
    await expect(l.targetDefault).toBeAttached();
  });
});
