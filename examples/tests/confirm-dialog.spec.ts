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

  // ── Variant 3: wizard with multiple useRender (useResume) ──

  test("variant 3: starts on name step", async ({ page }) => {
    await expect(page.getByTestId("v3-step-name")).toBeVisible();
    await expect(page.getByTestId("v3-step-color")).not.toBeAttached();
    await expect(page.getByTestId("v3-result")).not.toBeAttached();
  });

  test("variant 3: completing name step advances to color step", async ({ page }) => {
    await page.getByTestId("v3-name-input").fill("Alice");
    await page.getByTestId("v3-name-next").click();

    await expect(page.getByTestId("v3-step-name")).not.toBeAttached();
    await expect(page.getByTestId("v3-step-color")).toBeVisible();
  });

  test("variant 3: completing both steps shows result", async ({ page }) => {
    await page.getByTestId("v3-name-input").fill("Bob");
    await page.getByTestId("v3-name-next").click();
    await page.getByTestId("v3-color-green").click();

    await expect(page.getByTestId("v3-step-color")).not.toBeAttached();
    await expect(page.getByTestId("v3-answer")).toHaveText("Bob");
    await expect(page.getByTestId("v3-color")).toHaveText("Green");
  });

  test("variant 3: reset returns to name step", async ({ page }) => {
    await page.getByTestId("v3-name-input").fill("Eve");
    await page.getByTestId("v3-name-next").click();
    await page.getByTestId("v3-color-red").click();
    await expect(page.getByTestId("v3-answer")).toHaveText("Eve");

    await page.getByTestId("v3-reset").click();
    await expect(page.getByTestId("v3-step-name")).toBeVisible();
    await expect(page.getByTestId("v3-result")).not.toBeAttached();
  });

  // ── Variant 4: wizard with multiple useRender (inline) ──

  test("variant 4: starts on step A", async ({ page }) => {
    await expect(page.getByTestId("v4-step-a")).toBeVisible();
    await expect(page.getByTestId("v4-step-b")).not.toBeAttached();
    await expect(page.getByTestId("v4-result")).not.toBeAttached();
  });

  test("variant 4: selecting A advances to step B", async ({ page }) => {
    await page.getByTestId("v4-a-2").click();

    await expect(page.getByTestId("v4-step-a")).not.toBeAttached();
    await expect(page.getByTestId("v4-step-b")).toBeVisible();
  });

  test("variant 4: completing both steps shows sum", async ({ page }) => {
    await page.getByTestId("v4-a-3").click();
    await page.getByTestId("v4-b-20").click();

    await expect(page.getByTestId("v4-answer")).toHaveText("23");
  });

  test("variant 4: reset returns to step A", async ({ page }) => {
    await page.getByTestId("v4-a-1").click();
    await page.getByTestId("v4-b-10").click();
    await expect(page.getByTestId("v4-answer")).toHaveText("11");

    await page.getByTestId("v4-reset").click();
    await expect(page.getByTestId("v4-step-a")).toBeVisible();
    await expect(page.getByTestId("v4-result")).not.toBeAttached();
  });

  // ── Variant 5: parent state reflected in useRender dialog ──

  test("variant 5: dialog shows initial quantity", async ({ page }) => {
    await expect(page.getByTestId("v5-dialog")).toBeVisible();
    await expect(page.getByTestId("v5-quantity")).toHaveText("1");
    await expect(page.getByTestId("v5-result")).not.toBeAttached();
  });

  test("variant 5: incrementing updates quantity in dialog", async ({ page }) => {
    await page.getByTestId("v5-increment").click();
    await expect(page.getByTestId("v5-quantity")).toHaveText("2");

    await page.getByTestId("v5-increment").click();
    await expect(page.getByTestId("v5-quantity")).toHaveText("3");
  });

  test("variant 5: decrementing updates quantity in dialog", async ({ page }) => {
    await page.getByTestId("v5-increment").click();
    await page.getByTestId("v5-increment").click();
    await expect(page.getByTestId("v5-quantity")).toHaveText("3");

    await page.getByTestId("v5-decrement").click();
    await expect(page.getByTestId("v5-quantity")).toHaveText("2");
  });

  test("variant 5: confirming shows the current quantity", async ({ page }) => {
    await page.getByTestId("v5-increment").click();
    await page.getByTestId("v5-increment").click();
    await page.getByTestId("v5-increment").click();
    await expect(page.getByTestId("v5-quantity")).toHaveText("4");

    await page.getByTestId("v5-confirm").click();
    await expect(page.getByTestId("v5-dialog")).not.toBeAttached();
    await expect(page.getByTestId("v5-answer")).toHaveText("4");
  });
});
