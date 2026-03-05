import { test, expect } from '@playwright/test';
import { goToTab } from './helpers';

test.describe('Context / Theme example', () => {
  test.beforeEach(async ({ page }) => {
    await goToTab(page, 'Context / Theme');
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
