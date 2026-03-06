import { test, expect } from '@playwright/test';
import { goToApp, clickTab } from './helpers';

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
