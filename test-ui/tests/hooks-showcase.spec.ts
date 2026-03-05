import { test, expect } from '@playwright/test';
import { goToTab } from './helpers';

test.describe('Hooks Showcase example', () => {
  test.beforeEach(async ({ page }) => {
    await goToTab(page, 'Hooks Showcase');
    await page.waitForSelector('[data-testid="hooks-search-input"]');
  });

  test('renders the full fruit list initially', async ({ page }) => {
    await expect(page.locator('[data-testid="hooks-fruit-list"] li')).toHaveCount(12);
    await page.screenshot({ path: 'test-results/hooks-initial.png' });
  });

  test('filters the list via useMemo when the search input changes', async ({ page }) => {
    await page.getByTestId('hooks-search-input').fill('an');
    // 'Banana', 'Mango' contain 'an'
    await expect(page.locator('[data-testid="hooks-fruit-list"] li')).toHaveCount(2);
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
    await expect(page.locator(`label[for="${inputId}"]`)).toBeVisible();
  });
});
