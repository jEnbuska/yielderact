import { test, expect } from '@playwright/test';
import { goToApp } from './helpers';

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
