import { test } from "@playwright/test";

// TODO: Restore when $patch is re-implemented (#163)
// All tests in this file are skipped until the $patch feature is restored.

test.describe
  .skip("UI Patch example", () => {
    // test.beforeEach(async ({ page }) => {
    //   await goToApp(page);
    //   await clickTab(page, "UI Patch");
    //   await page.waitForSelector('[data-testid="global-patch-demo"]');
    // });
    //
    // test("renders both global and local patch sections", async ({ page }) => { ... });
    // test("global patch: home page is shown by default", async ({ page }) => { ... });
    // test("global patch: navigation buttons are re-enabled after patch commits", async ({ page }) => { ... });
    // test("local patch: navigation buttons are re-enabled after patch commits", async ({ page }) => { ... });
    // test("clocks demo: renders all three clock variants", async ({ page }) => { ... });
    // test("clocks demo: clocks display a time string", async ({ page }) => { ... });
    // test("global patch: navigates to about page after async delay", async ({ page }) => { ... });
    // test("global patch: DOM is frozen until patch commits", async ({ page }) => { ... });
    // test("global patch: shows navigation log entries after commit", async ({ page }) => { ... });
    // test("local patch: home page is shown by default", async ({ page }) => { ... });
    // test("local patch: navigates to contact page after async delay", async ({ page }) => { ... });
    // test("clocks tick every second and display valid time strings", async ({ page }) => { ... });
    // test('$patch="live" clock updates during a global patch while $patch="default" stays frozen', async ({ page }) => { ... });
    // test('$patch="live" clock updates during a local patch while $patch="default" stays frozen', async ({ page }) => { ... });
  });

test.describe
  .skip("Visibility during global patch", () => {
    // test("default element stays visible when removed during patch, gone after commit", async ({ page }) => { ... });
    // test('$patch="live" element disappears immediately when removed during patch', async ({ page }) => { ... });
    // test("default element does not appear when added during patch, appears after commit", async ({ page }) => { ... });
    // test('$patch="live" element appears immediately when added during patch', async ({ page }) => { ... });
    // test("live element removed then re-added: disappears immediately and reappears immediately", async ({ page }) => { ... });
    // test("default element removed then re-added: visible throughout, present after commit", async ({ page }) => { ... });
    // test("default element added then removed during patch: absent throughout and after commit", async ({ page }) => { ... });
    // test("live element added then removed: not present after commit", async ({ page }) => { ... });
  });

test.describe
  .skip("Visibility during local patch", () => {
    // test("default element stays visible when removed during local patch, gone after commit", async ({ page }) => { ... });
    // test('$patch="live" element disappears immediately during local patch', async ({ page }) => { ... });
    // test("default element does not appear during local patch, appears after commit", async ({ page }) => { ... });
    // test('$patch="live" element appears immediately during local patch', async ({ page }) => { ... });
    // test("live element removed then re-added during local patch: correct immediate and final state", async ({ page }) => { ... });
    // test("default element removed then re-added: visible throughout, present after commit", async ({ page }) => { ... });
  });
