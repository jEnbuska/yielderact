import { test, expect } from '@playwright/test';
import { goToTab } from './helpers';

test.describe('Todo List example', () => {
  test.beforeEach(async ({ page }) => {
    await goToTab(page, 'Todo List');
    await page.waitForSelector('[data-testid="todo-input"]');
  });

  test('renders the initial todos', async ({ page }) => {
    await expect(page.locator('[data-testid="todo-list"] li')).toHaveCount(2);
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
