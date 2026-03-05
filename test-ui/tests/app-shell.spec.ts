import { test, expect } from '@playwright/test';
import { goToApp } from './helpers';

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
