/**
 * Visual tests for UI Patch: global and local patch lifecycle, verifying
 * that child prop changes before/during a patch survive to commit.
 */
import { expect, test } from "./fixtures";

// Regression: prevSlot.props was written with allProps during the live-only
// skip pass, so at commit time shallowEqual returned true and the component
// was never re-rendered with the new props (e.g. isPending: false).

test("global patch: child prop change before patch survives to commit (disabled button re-enabled)", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, startUIPatch, commitUIPatch } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    let setPending: ((v: boolean) => void) | null = null;
    let doCommit: (() => void) | null = null;

    // Child component: renders a button whose disabled state mirrors the prop
    function* Nav(props: { isPending: boolean }) {
      return createElement("button", { id: "nav-btn", disabled: props.isPending }, "click");
    }

    function* App() {
      const [isPending, setP] = yield* useState(false);
      setPending = setP as never;
      return createElement("div", null, createElement(Nav as never, { isPending }));
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);

    // Step 1: set isPending=true BEFORE the patch (immediate DOM update)
    setPending?.(true);

    // Step 2: start the patch
    startUIPatch();

    // Step 3: clear isPending INSIDE the patch (deferred — DOM still shows disabled)
    setPending?.(false);

    // Expose a commit handle for the test to call after asserting frozen state
    doCommit = commitUIPatch;
    (window as unknown as { doCommit: typeof doCommit }).doCommit = doCommit;
  });

  // During the patch the button must still be disabled (DOM is frozen)
  await expect(page.locator("#nav-btn")).toBeDisabled();

  // Commit the patch
  await page.evaluate(() => {
    (window as unknown as { doCommit: () => void }).doCommit();
  });

  // After commit the button must be re-enabled
  await expect(page.locator("#nav-btn")).not.toBeDisabled();
  await page.screenshot({ path: "/tmp/visual-patch-prop-update-global.png" });
});

test("local patch: child prop change before patch survives to commit (disabled button re-enabled)", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useUIPatch } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    let setPending: ((v: boolean) => void) | null = null;
    let capturedStartPatch: (() => () => void) | null = null;

    function* Nav(props: { isPending: boolean }) {
      return createElement("button", { id: "nav-btn", disabled: props.isPending }, "click");
    }

    function* App() {
      const startPatch = yield* useUIPatch();
      capturedStartPatch = startPatch;
      const [isPending, setP] = yield* useState(false);
      setPending = setP as never;
      return createElement("div", null, createElement(Nav as never, { isPending }));
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);

    // Step 1: set isPending=true BEFORE the patch (immediate DOM update)
    setPending?.(true);

    // Step 2: start the local patch and capture the commit fn
    const commit = capturedStartPatch?.();

    // Step 3: clear isPending inside the patch (deferred)
    setPending?.(false);

    // Expose the commit fn for the test to call after asserting the frozen state
    (window as unknown as { doCommit: () => void }).doCommit = commit;
  });

  // DOM must be frozen — button still disabled
  await expect(page.locator("#nav-btn")).toBeDisabled();

  // Commit
  await page.evaluate(() => {
    (window as unknown as { doCommit: () => void }).doCommit();
  });

  // After commit the button must be re-enabled
  await expect(page.locator("#nav-btn")).not.toBeDisabled();
  await page.screenshot({ path: "/tmp/visual-patch-prop-update-local.png" });
});
