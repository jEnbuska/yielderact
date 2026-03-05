import { test, expect } from '@playwright/test';
import { goToTab } from './helpers';

test.describe('shown prop example', () => {
  test.beforeEach(async ({ page }) => {
    await goToTab(page, '$shown prop');
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

    await page.getByTestId('toggle-element').check();
    await expect(page.getByTestId('shown-element')).toBeVisible();
  });

  test('hides and shows the function component', async ({ page }) => {
    await page.getByTestId('toggle-function').uncheck();
    await expect(page.getByTestId('info-panel')).not.toBeAttached();

    await page.getByTestId('toggle-function').check();
    await expect(page.getByTestId('info-panel')).toBeVisible();
  });

  test('hides and shows the generator component', async ({ page }) => {
    await page.getByTestId('toggle-generator').uncheck();
    await expect(page.getByTestId('stateful-counter')).not.toBeAttached();

    await page.getByTestId('toggle-generator').check();
    await expect(page.getByTestId('stateful-counter')).toBeVisible();
  });

  test('generator component state resets after re-mount', async ({ page }) => {
    await page.getByTestId('counter-inc').click();
    await page.getByTestId('counter-inc').click();
    await expect(page.getByTestId('counter-val')).toHaveText('2');

    await page.getByTestId('toggle-generator').uncheck();
    await page.getByTestId('toggle-generator').check();
    await expect(page.getByTestId('counter-val')).toHaveText('0');
  });
});
