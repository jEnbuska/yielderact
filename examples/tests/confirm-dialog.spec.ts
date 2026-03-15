import { expect, test } from "@playwright/test";
import { clickTab, goToApp } from "./helpers";

test.describe("useRender / ConfirmDialog example", () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await clickTab(page, "useRender");
    await page.waitForSelector('[data-testid="v1-dialog"]');
  });

  // ── Variant 1: child uses useResume ──

  test("variant 1: dialog is visible while waiting for user input", async ({ page }) => {
    await expect(page.getByTestId("v1-dialog")).toBeVisible();
    await expect(page.getByTestId("v1-result")).not.toBeAttached();
    await page.screenshot({ path: "test-results/confirm-v1-dialog.png" });
  });

  test("variant 1: accepting shows ACCEPTED result", async ({ page }) => {
    await page.getByTestId("v1-accept").click();

    await expect(page.getByTestId("v1-dialog")).not.toBeAttached();
    await expect(page.getByTestId("v1-answer")).toHaveText("ACCEPTED");
    await page.screenshot({ path: "test-results/confirm-v1-accepted.png" });
  });

  test("variant 1: rejecting shows REJECTED result", async ({ page }) => {
    await page.getByTestId("v1-reject").click();

    await expect(page.getByTestId("v1-dialog")).not.toBeAttached();
    await expect(page.getByTestId("v1-answer")).toHaveText("REJECTED");
    await page.screenshot({ path: "test-results/confirm-v1-rejected.png" });
  });

  test("variant 1: reset returns to dialog", async ({ page }) => {
    await page.getByTestId("v1-accept").click();
    await expect(page.getByTestId("v1-answer")).toHaveText("ACCEPTED");

    await page.getByTestId("v1-reset").click();
    await expect(page.getByTestId("v1-dialog")).toBeVisible();
    await expect(page.getByTestId("v1-result")).not.toBeAttached();
    await page.screenshot({ path: "test-results/confirm-v1-reset.png" });
  });

  // ── Variant 2: inline render function ──

  test("variant 2: dialog is visible while waiting", async ({ page }) => {
    await expect(page.getByTestId("v2-dialog")).toBeVisible();
    await expect(page.getByTestId("v2-result")).not.toBeAttached();
    await page.screenshot({ path: "test-results/confirm-v2-dialog.png" });
  });

  test("variant 2: accepting shows ACCEPTED result", async ({ page }) => {
    await page.getByTestId("v2-accept").click();

    await expect(page.getByTestId("v2-dialog")).not.toBeAttached();
    await expect(page.getByTestId("v2-answer")).toHaveText("ACCEPTED");
    await page.screenshot({ path: "test-results/confirm-v2-accepted.png" });
  });

  test("variant 2: rejecting shows REJECTED result", async ({ page }) => {
    await page.getByTestId("v2-reject").click();

    await expect(page.getByTestId("v2-dialog")).not.toBeAttached();
    await expect(page.getByTestId("v2-answer")).toHaveText("REJECTED");
    await page.screenshot({ path: "test-results/confirm-v2-rejected.png" });
  });

  test("variant 2: reset returns to dialog", async ({ page }) => {
    await page.getByTestId("v2-reject").click();
    await expect(page.getByTestId("v2-answer")).toHaveText("REJECTED");

    await page.getByTestId("v2-reset").click();
    await expect(page.getByTestId("v2-dialog")).toBeVisible();
    await expect(page.getByTestId("v2-result")).not.toBeAttached();
    await page.screenshot({ path: "test-results/confirm-v2-reset.png" });
  });
});
