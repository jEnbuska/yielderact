/**
 * Visual tests for useRender and useResume hooks: Variant 1 (JSX child),
 * Variant 2 (inline function), resume value propagation, sequential renders,
 * different resume value types, loop patterns, and post-resume continuation.
 */
import { expect, test } from "./fixtures";

test("useRender Variant 1: child uses useResume to get resume callback and return value to parent", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useRender, useResume } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    function* Dialog() {
      const resume = yield* useResume<string>();
      return createElement(
        "div",
        { id: "dialog" },
        createElement("span", { id: "dialog-text" }, "Pick an option"),
        createElement("button", { id: "btn-accept", onclick: () => resume("ACCEPTED") }, "Accept"),
        createElement("button", { id: "btn-reject", onclick: () => resume("REJECTED") }, "Reject"),
      );
    }

    function* Parent() {
      const answer = yield* useRender<string>(createElement(Dialog as never, {}));
      return createElement("p", { id: "result" }, `Answer: ${answer}`);
    }

    render(createElement(Parent as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Dialog should be visible while waiting
  await expect(page.locator("#dialog")).toBeAttached();
  await expect(page.locator("#dialog-text")).toHaveText("Pick an option");

  // Click accept - parent generator resumes with "ACCEPTED"
  await page.click("#btn-accept");

  // Dialog gone, result shown
  await expect(page.locator("#dialog")).not.toBeAttached();
  await expect(page.locator("#result")).toHaveText("Answer: ACCEPTED");

  await page.screenshot({ path: "/tmp/visual-use-render-variant1.png" });
});

test("useRender Variant 2: inline function receives {resume} prop and returns value to parent", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useRender } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    function* Parent() {
      const answer = yield* useRender<string>(
        ({ resume }) =>
          createElement(
            "div",
            { id: "inline-dialog" },
            createElement("span", { id: "inline-text" }, "Choose wisely"),
            createElement("button", { id: "btn-yes", onclick: () => resume("YES") }, "Yes"),
            createElement("button", { id: "btn-no", onclick: () => resume("NO") }, "No"),
          ),
        [],
      );
      return createElement("p", { id: "result" }, `Choice: ${answer}`);
    }

    render(createElement(Parent as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Inline dialog visible while waiting
  await expect(page.locator("#inline-dialog")).toBeAttached();
  await expect(page.locator("#inline-text")).toHaveText("Choose wisely");

  // Click "No"
  await page.click("#btn-no");

  // Dialog gone, result shown
  await expect(page.locator("#inline-dialog")).not.toBeAttached();
  await expect(page.locator("#result")).toHaveText("Choice: NO");

  await page.screenshot({ path: "/tmp/visual-use-render-variant2.png" });
});

test("useRender: resume value is propagated back as the return value of yield* useRender()", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useRender } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    function* Parent() {
      const value = yield* useRender<number>(
        ({ resume }) =>
          createElement(
            "div",
            { id: "picker" },
            createElement("button", { id: "btn-42", onclick: () => resume(42) }, "Pick 42"),
            createElement("button", { id: "btn-99", onclick: () => resume(99) }, "Pick 99"),
          ),
        [],
      );
      // Display both the value and its type to verify propagation
      return createElement(
        "div",
        { id: "propagated" },
        createElement("span", { id: "val" }, String(value)),
        createElement("span", { id: "type" }, typeof value),
      );
    }

    render(createElement(Parent as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.locator("#picker")).toBeAttached();

  await page.click("#btn-42");

  await expect(page.locator("#picker")).not.toBeAttached();
  await expect(page.locator("#val")).toHaveText("42");
  await expect(page.locator("#type")).toHaveText("number");

  await page.screenshot({ path: "/tmp/visual-use-render-propagation.png" });
});

// BUG: Sequential yield* useRender() calls in the same generator don't advance correctly.
// The second useRender reuses the same hookIndex, and _processRender with unchanged deps
// doesn't properly reinitialize the slot for the new generator invocation.
test.fixme("useRender: multiple sequential useRender calls - first resolves, second starts", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useRender } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    function* Wizard() {
      // Step 1
      const name = yield* useRender<string>(
        ({ resume }) =>
          createElement(
            "div",
            { id: "step1" },
            createElement("span", null, "Step 1: Enter name"),
            createElement(
              "button",
              { id: "btn-name", onclick: () => resume("Alice") },
              "Submit Alice",
            ),
          ),
        [],
      );

      // Step 2
      const age = yield* useRender<number>(
        ({ resume }) =>
          createElement(
            "div",
            { id: "step2" },
            createElement("span", null, `Step 2: Age for ${name}`),
            createElement("button", { id: "btn-age", onclick: () => resume(30) }, "Submit 30"),
          ),
        [],
      );

      return createElement(
        "div",
        { id: "summary" },
        createElement("span", { id: "s-name" }, name),
        createElement("span", { id: "s-age" }, String(age)),
      );
    }

    render(createElement(Wizard as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Step 1 visible, Step 2 and summary not
  await expect(page.locator("#step1")).toBeAttached();
  await expect(page.locator("#step2")).not.toBeAttached();
  await expect(page.locator("#summary")).not.toBeAttached();

  // Complete step 1
  await page.click("#btn-name");

  // Step 1 gone, Step 2 visible
  await expect(page.locator("#step1")).not.toBeAttached();
  await expect(page.locator("#step2")).toBeAttached();
  await expect(page.locator("#summary")).not.toBeAttached();

  // Complete step 2
  await page.click("#btn-age");

  // Both steps gone, summary visible
  await expect(page.locator("#step1")).not.toBeAttached();
  await expect(page.locator("#step2")).not.toBeAttached();
  await expect(page.locator("#summary")).toBeAttached();
  await expect(page.locator("#s-name")).toHaveText("Alice");
  await expect(page.locator("#s-age")).toHaveText("30");

  await page.screenshot({ path: "/tmp/visual-use-render-sequential.png" });
});

// BUG: Same issue as sequential useRender — multiple yield* useRender() calls at the same hookIndex.
test.fixme("useRender: resume with different value types (string, number, object)", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useRender } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    function* TypeTester() {
      // Step 1: string
      const strVal = yield* useRender<string>(
        ({ resume }) =>
          createElement(
            "div",
            { id: "str-step" },
            createElement(
              "button",
              { id: "btn-str", onclick: () => resume("hello") },
              "Send string",
            ),
          ),
        [],
      );

      // Step 2: number
      const numVal = yield* useRender<number>(
        ({ resume }) =>
          createElement(
            "div",
            { id: "num-step" },
            createElement("button", { id: "btn-num", onclick: () => resume(3.14) }, "Send number"),
          ),
        [],
      );

      // Step 3: object
      const objVal = yield* useRender<{ x: number; y: number }>(
        ({ resume }) =>
          createElement(
            "div",
            { id: "obj-step" },
            createElement(
              "button",
              { id: "btn-obj", onclick: () => resume({ x: 10, y: 20 }) },
              "Send object",
            ),
          ),
        [],
      );

      return createElement(
        "div",
        { id: "types-result" },
        createElement("span", { id: "r-str" }, strVal),
        createElement("span", { id: "r-str-type" }, typeof strVal),
        createElement("span", { id: "r-num" }, String(numVal)),
        createElement("span", { id: "r-num-type" }, typeof numVal),
        createElement("span", { id: "r-obj" }, JSON.stringify(objVal)),
        createElement("span", { id: "r-obj-type" }, typeof objVal),
      );
    }

    render(createElement(TypeTester as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Step 1: string
  await expect(page.locator("#str-step")).toBeAttached();
  await page.click("#btn-str");

  // Step 2: number
  await expect(page.locator("#str-step")).not.toBeAttached();
  await expect(page.locator("#num-step")).toBeAttached();
  await page.click("#btn-num");

  // Step 3: object
  await expect(page.locator("#num-step")).not.toBeAttached();
  await expect(page.locator("#obj-step")).toBeAttached();
  await page.click("#btn-obj");

  // Verify all types
  await expect(page.locator("#types-result")).toBeAttached();
  await expect(page.locator("#r-str")).toHaveText("hello");
  await expect(page.locator("#r-str-type")).toHaveText("string");
  await expect(page.locator("#r-num")).toHaveText("3.14");
  await expect(page.locator("#r-num-type")).toHaveText("number");
  await expect(page.locator("#r-obj")).toHaveText('{"x":10,"y":20}');
  await expect(page.locator("#r-obj-type")).toHaveText("object");

  await page.screenshot({ path: "/tmp/visual-use-render-value-types.png" });
});

// BUG: Same issue — useRender in a loop reuses the same hookIndex with unchanged deps.
test.fixme("useRender in a loop: repeated renders until condition met", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useRender, useRef } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    function* GuessingGame() {
      const target = 3;
      const attempts = yield* useRef(0);

      let guess = 0;
      while (guess !== target) {
        guess = yield* useRender<number>(
          ({ resume }) =>
            createElement(
              "div",
              { id: "guess-ui" },
              createElement("span", { id: "attempt-count" }, `Attempts: ${attempts.current}`),
              createElement("button", { id: "btn-g1", onclick: () => resume(1) }, "Guess 1"),
              createElement("button", { id: "btn-g2", onclick: () => resume(2) }, "Guess 2"),
              createElement("button", { id: "btn-g3", onclick: () => resume(3) }, "Guess 3"),
            ),
          [],
        );
        attempts.current++;
      }

      return createElement(
        "div",
        { id: "game-over" },
        createElement("span", { id: "total-attempts" }, String(attempts.current)),
      );
    }

    render(
      createElement(GuessingGame as never, {}),
      document.getElementById("root") as HTMLElement,
    );
  });

  // Initial state: guess UI visible
  await expect(page.locator("#guess-ui")).toBeAttached();
  await expect(page.locator("#attempt-count")).toHaveText("Attempts: 0");

  // Wrong guess 1
  await page.click("#btn-g1");
  await expect(page.locator("#guess-ui")).toBeAttached();
  await expect(page.locator("#attempt-count")).toHaveText("Attempts: 1");

  // Wrong guess 2
  await page.click("#btn-g2");
  await expect(page.locator("#guess-ui")).toBeAttached();
  await expect(page.locator("#attempt-count")).toHaveText("Attempts: 2");

  // Correct guess 3 - exits the loop
  await page.click("#btn-g3");
  await expect(page.locator("#guess-ui")).not.toBeAttached();
  await expect(page.locator("#game-over")).toBeAttached();
  await expect(page.locator("#total-attempts")).toHaveText("3");

  await page.screenshot({ path: "/tmp/visual-use-render-loop.png" });
});

test("useRender: parent generator continues after resume and renders different UI", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useRender, useResume } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* ConfirmDialog() {
      const resume = yield* useResume<boolean>();
      return createElement(
        "div",
        { id: "confirm" },
        createElement("span", null, "Are you sure?"),
        createElement("button", { id: "btn-confirm", onclick: () => resume(true) }, "Confirm"),
        createElement("button", { id: "btn-cancel", onclick: () => resume(false) }, "Cancel"),
      );
    }

    function* App() {
      const [phase, setPhase] = yield* useState<"idle" | "asking" | "done">("idle");
      win.startFlow = () => setPhase("asking");

      if (phase === "idle") {
        return createElement(
          "div",
          { id: "idle-ui" },
          createElement("span", null, "Nothing happening"),
          createElement("button", { id: "btn-start", onclick: () => setPhase("asking") }, "Start"),
        );
      }

      if (phase === "asking") {
        const confirmed = yield* useRender<boolean>(createElement(ConfirmDialog as never, {}));

        // After resume, generator continues here with the result
        if (confirmed) {
          return createElement("div", { id: "confirmed-ui" }, "Action confirmed!");
        }
        return createElement(
          "div",
          { id: "cancelled-ui" },
          createElement("span", null, "Action cancelled"),
          createElement(
            "button",
            { id: "btn-retry", onclick: () => setPhase("asking") },
            "Try again",
          ),
        );
      }

      return createElement("div", { id: "done-ui" }, "Done");
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Idle state
  await expect(page.locator("#idle-ui")).toBeAttached();

  // Start the flow
  await page.click("#btn-start");

  // Confirm dialog visible
  await expect(page.locator("#idle-ui")).not.toBeAttached();
  await expect(page.locator("#confirm")).toBeAttached();

  // Cancel - parent continues, renders cancelled UI
  await page.click("#btn-cancel");
  await expect(page.locator("#confirm")).not.toBeAttached();
  await expect(page.locator("#cancelled-ui")).toBeAttached();

  // Try again
  await page.click("#btn-retry");
  await expect(page.locator("#cancelled-ui")).not.toBeAttached();
  await expect(page.locator("#confirm")).toBeAttached();

  // Confirm this time
  await page.click("#btn-confirm");
  await expect(page.locator("#confirm")).not.toBeAttached();
  await expect(page.locator("#confirmed-ui")).toHaveText("Action confirmed!");

  await page.screenshot({ path: "/tmp/visual-use-render-continuation.png" });
});
