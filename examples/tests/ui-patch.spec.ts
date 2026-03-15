import { expect, type Page, test } from "@playwright/test";
import { clickTab, goToApp } from "./helpers";

/** Helpers scoped to one of the two visibility demos. */
async function visibilitySetup(page: Page, scope: "gv" | "lv") {
  const panel = page.locator(
    `[data-testid="${scope === "gv" ? "global" : "local"}-visibility-demo"]`,
  );
  const startBtn = panel.locator(`[data-testid="${scope}-start-patch"]`);
  const commitBtn = panel.locator(`[data-testid="${scope}-commit-patch"]`);
  const toggleDefault = panel.locator(`[data-testid="${scope}-toggle-default"]`);
  const toggleLive = panel.locator(`[data-testid="${scope}-toggle-live"]`);
  const targetDefault = page.locator(`[data-testid="${scope}-target-default"]`);
  const targetLive = page.locator(`[data-testid="${scope}-target-live"]`);
  return { panel, startBtn, commitBtn, toggleDefault, toggleLive, targetDefault, targetLive };
}

test.describe("UI Patch example", () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await clickTab(page, "UI Patch");
    // Wait for the Global patch section to appear
    await page.waitForSelector('[data-testid="global-patch-demo"]');
  });

  test("renders both global and local patch sections", async ({ page }) => {
    await expect(page.getByTestId("global-patch-heading")).toBeVisible();
    await expect(page.getByTestId("local-patch-heading")).toBeVisible();
    await page.screenshot({ path: "test-results/ui-patch-initial.png" });
  });

  test("global patch: home page is shown by default", async ({ page }) => {
    await expect(page.getByTestId("page-home").first()).toBeVisible();
    await page.screenshot({ path: "test-results/ui-patch-home.png" });
  });

  // ── Navigation button state regression ──────────────────────────────────
  // Regression for the bug where navigation buttons stayed disabled/cursor:wait
  // after the UI patch committed, because prevSlot.props was pre-emptively
  // updated during the live-only pass, causing shallowEqual to skip the
  // Navigation component at commit time.

  test("global patch: navigation buttons are re-enabled after patch commits", async ({ page }) => {
    await page.getByTestId("global-nav-about").click();

    // Wait for navigation to complete and the about page to appear
    await expect(page.getByTestId("page-about").first()).toBeVisible({ timeout: 7000 });

    // All navigation buttons must be re-enabled after the patch commits
    await expect(page.getByTestId("global-nav-home")).not.toBeDisabled();
    await expect(page.getByTestId("global-nav-about")).not.toBeDisabled();
    await expect(page.getByTestId("global-nav-contact")).not.toBeDisabled();

    // Button labels must be back to plain text (not '…' which shows during isPending)
    await expect(page.getByTestId("global-nav-home")).toHaveText("home");
    await expect(page.getByTestId("global-nav-about")).toHaveText("about");
    await expect(page.getByTestId("global-nav-contact")).toHaveText("contact");

    await page.screenshot({ path: "test-results/ui-patch-global-nav-reenabled.png" });
  });

  test("local patch: navigation buttons are re-enabled after patch commits", async ({ page }) => {
    await page.getByTestId("local-nav-about").click();

    // Wait for navigation to complete and the about page to appear
    await expect(page.getByTestId("page-about").first()).toBeVisible({ timeout: 7000 });

    // Navigation buttons in the local patch nav must be re-enabled
    await expect(page.getByTestId("local-nav-home")).not.toBeDisabled();
    await expect(page.getByTestId("local-nav-about")).not.toBeDisabled();
    await expect(page.getByTestId("local-nav-contact")).not.toBeDisabled();

    // Labels back to plain text
    await expect(page.getByTestId("local-nav-home")).toHaveText("home");
    await expect(page.getByTestId("local-nav-about")).toHaveText("about");
    await expect(page.getByTestId("local-nav-contact")).toHaveText("contact");

    await page.screenshot({ path: "test-results/ui-patch-local-nav-reenabled.png" });
  });

  test("clocks demo: renders all three clock variants", async ({ page }) => {
    await expect(page.getByTestId("clock-default").first()).toBeVisible();
    await expect(page.getByTestId("clock-live").first()).toBeVisible();
    await expect(page.getByTestId("clock-alternating").first()).toBeVisible();
    await page.screenshot({ path: "test-results/ui-patch-clocks.png" });
  });

  test("clocks demo: clocks display a time string", async ({ page }) => {
    const clockEl = page.getByTestId("clock-default").first();
    await expect(clockEl).toBeVisible();
    const text = await clockEl.textContent();
    // toLocaleTimeString('en-US') produces e.g. "3:45:11 PM" or "12:34:56 PM"
    expect(text).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    await page.screenshot({ path: "test-results/ui-patch-clock-time.png" });
  });

  test("global patch: navigates to about page after async delay", async ({ page }) => {
    await page.getByTestId("global-nav-about").click();

    // Navigation takes 5 s — use a generous timeout
    await expect(page.getByTestId("page-about").first()).toBeVisible({ timeout: 7000 });
    await page.screenshot({ path: "test-results/ui-patch-about.png" });
  });

  test("global patch: DOM is frozen until patch commits", async ({ page }) => {
    await page.getByTestId("global-nav-about").click();

    // Immediately after click the home page must still be visible (DOM is frozen)
    await expect(page.getByTestId("page-home").first()).toBeVisible();

    // After the 5 s patch commits the about page replaces it
    await expect(page.getByTestId("page-about").first()).toBeVisible({ timeout: 7000 });
    await page.screenshot({ path: "test-results/ui-patch-frozen-then-committed.png" });
  });

  test("global patch: shows navigation log entries after commit", async ({ page }) => {
    await page.getByTestId("global-nav-contact").click();

    // Both log entries are deferred — they appear together after the 5 s commit
    await expect(page.getByTestId("global-patch-log")).toContainText(
      "[global] navigating to contact",
      { timeout: 7000 },
    );
    await expect(page.getByTestId("global-patch-log")).toContainText(
      "[global] arrived at contact",
      { timeout: 7000 },
    );
    await page.screenshot({ path: "test-results/ui-patch-log.png" });
  });

  test("local patch: home page is shown by default", async ({ page }) => {
    // The local patch demo also has HomePage/AboutPage/ContactPage
    await expect(page.getByTestId("page-home").nth(1)).toBeVisible();
  });

  test("local patch: navigates to contact page after async delay", async ({ page }) => {
    await page.getByTestId("local-nav-contact").click();

    await expect(page.getByTestId("page-contact").first()).toBeVisible({ timeout: 7000 });
    await page.screenshot({ path: "test-results/ui-patch-local-contact.png" });
  });

  test("clocks tick every second and display valid time strings", async ({ page }) => {
    // After 1 s the clocks tick — verify all clock containers still show valid times
    await page.waitForTimeout(1100);
    for (const testId of ["clock-default", "clock-live", "clock-alternating"]) {
      const text = await page
        .getByTestId(testId)
        .first()
        .locator('[data-testid="clock-time"]')
        .textContent();
      expect(text).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    }
    await page.screenshot({ path: "test-results/ui-patch-clocks-ticked.png" });
  });

  // ── $patch="live" correctness tests ─────────────────────────────────────

  test('$patch="live" clock updates during a global patch while $patch="default" stays frozen', async ({
    page,
  }) => {
    // Start the 5 s global-patch navigation
    await page.getByTestId("global-nav-about").click();

    // Wait 1.5 s so a clock tick is guaranteed to have occurred while the patch
    // is still in progress (patch runs for 5 s total).
    await page.waitForTimeout(1500);

    // Snapshot both clocks at this mid-patch moment (first instance = global demo)
    const globalDemo = page.getByTestId("global-patch-demo");
    const liveBefore = await globalDemo
      .getByTestId("clock-live")
      .locator('[data-testid="clock-time"]')
      .textContent();
    const defaultBefore = await globalDemo
      .getByTestId("clock-default")
      .locator('[data-testid="clock-time"]')
      .textContent();

    // Wait another 1.5 s so another tick fires while the patch is still active
    await page.waitForTimeout(1500);

    const liveAfter = await globalDemo
      .getByTestId("clock-live")
      .locator('[data-testid="clock-time"]')
      .textContent();
    const defaultAfter = await globalDemo
      .getByTestId("clock-default")
      .locator('[data-testid="clock-time"]')
      .textContent();

    // The live clock MUST have changed — it is not frozen
    expect(liveAfter).not.toBe(liveBefore);

    // The default clock MUST remain frozen until the patch commits
    expect(defaultAfter).toBe(defaultBefore);

    await page.screenshot({ path: "test-results/ui-patch-live-vs-default.png" });
  });

  test('$patch="live" clock updates during a local patch while $patch="default" stays frozen', async ({
    page,
  }) => {
    // Start the 5 s local-patch navigation
    await page.getByTestId("local-nav-about").click();

    // Wait 1.5 s — patch is still active
    await page.waitForTimeout(1500);

    // Use the Clocks instance inside LocalPatchDemo
    const localDemo = page.getByTestId("local-patch-demo");
    const liveBefore = await localDemo
      .getByTestId("clock-live")
      .locator('[data-testid="clock-time"]')
      .textContent();
    const defaultBefore = await localDemo
      .getByTestId("clock-default")
      .locator('[data-testid="clock-time"]')
      .textContent();

    await page.waitForTimeout(1500);

    const liveAfter = await localDemo
      .getByTestId("clock-live")
      .locator('[data-testid="clock-time"]')
      .textContent();
    const defaultAfter = await localDemo
      .getByTestId("clock-default")
      .locator('[data-testid="clock-time"]')
      .textContent();

    expect(liveAfter).not.toBe(liveBefore);
    expect(defaultAfter).toBe(defaultBefore);

    await page.screenshot({ path: "test-results/ui-patch-local-live-vs-default.png" });
  });
});

// ---------------------------------------------------------------------------
// Visibility during global patch
// ---------------------------------------------------------------------------

test.describe("Visibility during global patch", () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await clickTab(page, "UI Patch");
    await page.waitForSelector('[data-testid="global-visibility-demo"]');
  });

  test("default element stays visible when removed during patch, gone after commit", async ({
    page,
  }) => {
    const { startBtn, commitBtn, toggleDefault, targetDefault } = await visibilitySetup(page, "gv");

    await expect(targetDefault).toBeAttached();

    await startBtn.click();
    await toggleDefault.click(); // remove — frozen
    await expect(targetDefault).toBeAttached(); // still visible

    await commitBtn.click();
    await expect(targetDefault).not.toBeAttached(); // gone after commit

    await page.screenshot({ path: "test-results/gv-default-remove.png" });
  });

  test('$patch="live" element disappears immediately when removed during patch', async ({
    page,
  }) => {
    const { startBtn, commitBtn, toggleLive, targetLive } = await visibilitySetup(page, "gv");

    await expect(targetLive).toBeAttached();

    await startBtn.click();
    await toggleLive.click(); // live-remove → gone immediately
    await expect(targetLive).not.toBeAttached();

    await commitBtn.click();
    await expect(targetLive).not.toBeAttached(); // still gone after commit

    await page.screenshot({ path: "test-results/gv-live-remove.png" });
  });

  test("default element does not appear when added during patch, appears after commit", async ({
    page,
  }) => {
    const { startBtn, commitBtn, toggleDefault, targetDefault } = await visibilitySetup(page, "gv");

    // Start with element hidden
    await toggleDefault.click(); // hide before patch
    await expect(targetDefault).not.toBeAttached();

    await startBtn.click();
    await toggleDefault.click(); // add — frozen
    await expect(targetDefault).not.toBeAttached(); // not yet visible

    await commitBtn.click();
    await expect(targetDefault).toBeAttached(); // appears after commit

    await page.screenshot({ path: "test-results/gv-default-add.png" });
  });

  test('$patch="live" element appears immediately when added during patch', async ({ page }) => {
    const { startBtn, commitBtn, toggleLive, targetLive } = await visibilitySetup(page, "gv");

    await toggleLive.click(); // hide before patch
    await expect(targetLive).not.toBeAttached();

    await startBtn.click();
    await toggleLive.click(); // live-add → appears immediately
    await expect(targetLive).toBeAttached();

    await commitBtn.click();
    await expect(targetLive).toBeAttached(); // still present after commit

    await page.screenshot({ path: "test-results/gv-live-add.png" });
  });

  test("live element removed then re-added: disappears immediately and reappears immediately", async ({
    page,
  }) => {
    const { startBtn, commitBtn, toggleLive, targetLive } = await visibilitySetup(page, "gv");

    await startBtn.click();
    await toggleLive.click(); // live-remove
    await expect(targetLive).not.toBeAttached();
    await toggleLive.click(); // live-re-add
    await expect(targetLive).toBeAttached();

    await commitBtn.click();
    await expect(targetLive).toBeAttached();

    await page.screenshot({ path: "test-results/gv-live-remove-readd.png" });
  });

  test("default element removed then re-added: visible throughout, present after commit", async ({
    page,
  }) => {
    const { startBtn, commitBtn, toggleDefault, targetDefault } = await visibilitySetup(page, "gv");

    await startBtn.click();
    await toggleDefault.click(); // frozen — still visible
    await expect(targetDefault).toBeAttached();
    await toggleDefault.click(); // re-add — still visible
    await expect(targetDefault).toBeAttached();

    await commitBtn.click();
    await expect(targetDefault).toBeAttached();
  });

  test("default element added then removed during patch: absent throughout and after commit", async ({
    page,
  }) => {
    const { startBtn, commitBtn, toggleDefault, targetDefault } = await visibilitySetup(page, "gv");

    await toggleDefault.click(); // hide before patch
    await expect(targetDefault).not.toBeAttached();

    await startBtn.click();
    await toggleDefault.click(); // add (frozen — still absent)
    await expect(targetDefault).not.toBeAttached();
    await toggleDefault.click(); // remove again (frozen — still absent)
    await expect(targetDefault).not.toBeAttached();

    await commitBtn.click();
    await expect(targetDefault).not.toBeAttached(); // final state: hidden

    await page.screenshot({ path: "test-results/gv-default-add-remove.png" });
  });

  test("live element added then removed: not present after commit", async ({ page }) => {
    const { startBtn, commitBtn, toggleLive, targetLive } = await visibilitySetup(page, "gv");

    await toggleLive.click(); // hide before patch
    await startBtn.click();
    await toggleLive.click(); // live-add
    await expect(targetLive).toBeAttached();
    await toggleLive.click(); // live-remove
    await expect(targetLive).not.toBeAttached();

    await commitBtn.click();
    await expect(targetLive).not.toBeAttached();

    await page.screenshot({ path: "test-results/gv-live-add-remove.png" });
  });
});

// ---------------------------------------------------------------------------
// Visibility during local patch
// ---------------------------------------------------------------------------

test.describe("Visibility during local patch", () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await clickTab(page, "UI Patch");
    await page.waitForSelector('[data-testid="local-visibility-demo"]');
  });

  test("default element stays visible when removed during local patch, gone after commit", async ({
    page,
  }) => {
    const { startBtn, commitBtn, toggleDefault, targetDefault } = await visibilitySetup(page, "lv");

    await expect(targetDefault).toBeAttached();

    await startBtn.click();
    await toggleDefault.click();
    await expect(targetDefault).toBeAttached(); // frozen

    await commitBtn.click();
    await expect(targetDefault).not.toBeAttached();

    await page.screenshot({ path: "test-results/lv-default-remove.png" });
  });

  test('$patch="live" element disappears immediately during local patch', async ({ page }) => {
    const { startBtn, commitBtn, toggleLive, targetLive } = await visibilitySetup(page, "lv");

    await startBtn.click();
    await toggleLive.click();
    await expect(targetLive).not.toBeAttached(); // live-remove: immediate

    await commitBtn.click();
    await expect(targetLive).not.toBeAttached();

    await page.screenshot({ path: "test-results/lv-live-remove.png" });
  });

  test("default element does not appear during local patch, appears after commit", async ({
    page,
  }) => {
    const { startBtn, commitBtn, toggleDefault, targetDefault } = await visibilitySetup(page, "lv");

    await toggleDefault.click(); // hide before patch
    await startBtn.click();
    await toggleDefault.click(); // frozen
    await expect(targetDefault).not.toBeAttached();

    await commitBtn.click();
    await expect(targetDefault).toBeAttached();

    await page.screenshot({ path: "test-results/lv-default-add.png" });
  });

  test('$patch="live" element appears immediately during local patch', async ({ page }) => {
    const { startBtn, commitBtn, toggleLive, targetLive } = await visibilitySetup(page, "lv");

    await toggleLive.click(); // hide before patch
    await startBtn.click();
    await toggleLive.click(); // live-add
    await expect(targetLive).toBeAttached();

    await commitBtn.click();
    await expect(targetLive).toBeAttached();

    await page.screenshot({ path: "test-results/lv-live-add.png" });
  });

  test("live element removed then re-added during local patch: correct immediate and final state", async ({
    page,
  }) => {
    const { startBtn, commitBtn, toggleLive, targetLive } = await visibilitySetup(page, "lv");

    await startBtn.click();
    await toggleLive.click(); // live-remove
    await expect(targetLive).not.toBeAttached();
    await toggleLive.click(); // live-re-add
    await expect(targetLive).toBeAttached();

    await commitBtn.click();
    await expect(targetLive).toBeAttached();
  });

  test("default element removed then re-added: visible throughout, present after commit", async ({
    page,
  }) => {
    const { startBtn, commitBtn, toggleDefault, targetDefault } = await visibilitySetup(page, "lv");

    await startBtn.click();
    await toggleDefault.click(); // frozen: still visible
    await expect(targetDefault).toBeAttached();
    await toggleDefault.click(); // frozen: still visible
    await expect(targetDefault).toBeAttached();

    await commitBtn.click();
    await expect(targetDefault).toBeAttached();
  });
});
