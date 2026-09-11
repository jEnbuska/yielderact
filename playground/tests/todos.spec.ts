import { expect, test } from "@playwright/test";
import { clickTab, goToApp } from "./helpers";

test.describe("Todo List example", () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await clickTab(page, "Todo List");
    await page.waitForSelector('[data-testid="todo-input"]');
  });

  test("renders the initial todos", async ({ page }) => {
    await expect(page.getByTestId("todo-item-1")).toBeVisible();
    await expect(page.getByTestId("todo-item-2")).toBeVisible();
    await page.screenshot({ path: "test-results/todos-initial.png" });
  });

  test("adds a new todo", async ({ page }) => {
    await page.getByTestId("todo-input").fill("Write Playwright tests");
    await page.getByTestId("add-todo-btn").click();

    await expect(page.getByTestId("todo-item-3")).toBeVisible();
    await expect(page.getByTestId("todo-item-3")).toContainText("Write Playwright tests");
    await page.screenshot({ path: "test-results/todos-added.png" });
  });

  test("adds a todo by pressing Enter", async ({ page }) => {
    await page.getByTestId("todo-input").fill("Press Enter to add");
    await page.getByTestId("todo-input").press("Enter");

    await expect(page.getByTestId("todo-item-3")).toBeVisible();
    await expect(page.getByTestId("todo-item-3")).toContainText("Press Enter to add");
  });

  test("removes a todo", async ({ page }) => {
    // Remove the first todo
    await page.getByTestId("todo-remove-1").click();
    await expect(page.getByTestId("todo-item-1")).not.toBeAttached();
    await expect(page.getByTestId("todo-item-2")).toBeVisible();
    await page.screenshot({ path: "test-results/todos-removed.png" });
  });

  test("shows the empty message when all todos are removed", async ({ page }) => {
    await page.getByTestId("todo-remove-1").click();
    await page.getByTestId("todo-remove-2").click();
    await expect(page.getByTestId("empty-message")).toBeVisible();
    await page.screenshot({ path: "test-results/todos-empty.png" });
  });

  test("does not add an empty todo", async ({ page }) => {
    await page.getByTestId("add-todo-btn").click();
    // Still only the original 2 items
    await expect(page.getByTestId("todo-item-1")).toBeVisible();
    await expect(page.getByTestId("todo-item-2")).toBeVisible();
    await expect(page.getByTestId("todo-item-3")).not.toBeAttached();
  });
});
