/**
 * E2E tests for useRender / useResume hooks covering both variants:
 *   Variant 1 – child component uses useResume to obtain resume callback
 *   Variant 2 – inline render function receives { resume } as a prop
 */
import { expect, test } from "./fixtures";

/** Mount Variant 1: child component uses useResume */
async function mountVariant1(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    const { createElement, render, useState, useRef, useRender, useResume } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    function* ProceedDialog(_: object) {
      const resume = yield* useResume();
      return createElement(
        "div",
        null,
        createElement(
          "button",
          { "data-testid": "accept-btn", onclick: () => resume("ACCEPTED") },
          "Accept",
        ),
        createElement(
          "button",
          { "data-testid": "reject-btn", onclick: () => resume("REJECTED") },
          "Reject",
        ),
      );
    }

    function* Variant1(_: object) {
      const answer = yield* useRef("NONE");
      const [, rerender] = yield* useState(0);

      while (answer.current === "NONE") {
        answer.current = yield* useRender(createElement(ProceedDialog as never, {}));
      }

      return createElement(
        "div",
        null,
        createElement("span", { "data-testid": "v1-result" }, answer.current),
        createElement(
          "button",
          {
            "data-testid": "v1-reset",
            onclick: () => {
              answer.current = "NONE";
              rerender((n: number) => n + 1);
            },
          },
          "Reset",
        ),
      );
    }

    render(createElement(Variant1 as never, {}), document.getElementById("root") as HTMLElement);
  });
}

/** Mount Variant 2: inline render function */
async function mountVariant2(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    const { createElement, render, useState, useRef, useRender } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    function* Variant2(_: object) {
      const answer = yield* useRef("NONE");
      const [, rerender] = yield* useState(0);

      while (answer.current === "NONE") {
        answer.current = yield* useRender(
          ({ resume }: { resume: (v: string) => void }) =>
            createElement(
              "div",
              null,
              createElement(
                "button",
                {
                  "data-testid": "accept-inline-btn",
                  onclick: () => resume("ACCEPTED"),
                },
                "Accept inline",
              ),
              createElement(
                "button",
                {
                  "data-testid": "reject-inline-btn",
                  onclick: () => resume("REJECTED"),
                },
                "Reject inline",
              ),
            ),
          [],
        );
      }

      return createElement(
        "div",
        null,
        createElement("span", { "data-testid": "v2-result" }, answer.current),
        createElement(
          "button",
          {
            "data-testid": "v2-reset",
            onclick: () => {
              answer.current = "NONE";
              rerender((n: number) => n + 1);
            },
          },
          "Reset",
        ),
      );
    }

    render(createElement(Variant2 as never, {}), document.getElementById("root") as HTMLElement);
  });
}

// ---------------------------------------------------------------------------
// Variant 1 tests (child uses useResume)
// ---------------------------------------------------------------------------

test("variant 1: dialog shown initially with accept and reject buttons", async ({
  page,
  setupPage,
}) => {
  await setupPage();
  await mountVariant1(page);

  await expect(page.getByTestId("accept-btn")).toBeVisible();
  await expect(page.getByTestId("accept-btn")).toHaveText("Accept");
  await expect(page.getByTestId("reject-btn")).toBeVisible();
  await expect(page.getByTestId("reject-btn")).toHaveText("Reject");

  // Result span should not be in the DOM while the dialog is shown
  await expect(page.getByTestId("v1-result")).toHaveCount(0);
});

test("variant 1: accept resumes generator with ACCEPTED", async ({ page, setupPage }) => {
  await setupPage();
  await mountVariant1(page);

  await page.getByTestId("accept-btn").click();

  await expect(page.getByTestId("v1-result")).toHaveText("ACCEPTED");
  // Dialog buttons should no longer be visible
  await expect(page.getByTestId("accept-btn")).toHaveCount(0);
  await expect(page.getByTestId("reject-btn")).toHaveCount(0);
});

test("variant 1: reject resumes generator with REJECTED", async ({ page, setupPage }) => {
  await setupPage();
  await mountVariant1(page);

  await page.getByTestId("reject-btn").click();

  await expect(page.getByTestId("v1-result")).toHaveText("REJECTED");
  await expect(page.getByTestId("accept-btn")).toHaveCount(0);
  await expect(page.getByTestId("reject-btn")).toHaveCount(0);
});

test("variant 1: reset shows dialog again", async ({ page, setupPage }) => {
  await setupPage();
  await mountVariant1(page);

  // Accept first
  await page.getByTestId("accept-btn").click();
  await expect(page.getByTestId("v1-result")).toHaveText("ACCEPTED");

  // Reset
  await page.getByTestId("v1-reset").click();

  // Dialog should reappear
  await expect(page.getByTestId("accept-btn")).toBeVisible();
  await expect(page.getByTestId("reject-btn")).toBeVisible();
  await expect(page.getByTestId("v1-result")).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// Variant 2 tests (inline render function)
// ---------------------------------------------------------------------------

test("variant 2 inline: accept resumes with ACCEPTED", async ({ page, setupPage }) => {
  await setupPage();
  await mountVariant2(page);

  // Inline dialog buttons should be visible initially
  await expect(page.getByTestId("accept-inline-btn")).toBeVisible();
  await expect(page.getByTestId("reject-inline-btn")).toBeVisible();

  await page.getByTestId("accept-inline-btn").click();

  await expect(page.getByTestId("v2-result")).toHaveText("ACCEPTED");
  await expect(page.getByTestId("accept-inline-btn")).toHaveCount(0);
  await expect(page.getByTestId("reject-inline-btn")).toHaveCount(0);
});

test("variant 2 inline: reject resumes with REJECTED", async ({ page, setupPage }) => {
  await setupPage();
  await mountVariant2(page);

  await page.getByTestId("reject-inline-btn").click();

  await expect(page.getByTestId("v2-result")).toHaveText("REJECTED");
  await expect(page.getByTestId("accept-inline-btn")).toHaveCount(0);
  await expect(page.getByTestId("reject-inline-btn")).toHaveCount(0);
});

test("variant 2 inline: reset and accept again", async ({ page, setupPage }) => {
  await setupPage();
  await mountVariant2(page);

  // Reject first
  await page.getByTestId("reject-inline-btn").click();
  await expect(page.getByTestId("v2-result")).toHaveText("REJECTED");

  // Reset
  await page.getByTestId("v2-reset").click();

  // Dialog should reappear
  await expect(page.getByTestId("accept-inline-btn")).toBeVisible();
  await expect(page.getByTestId("reject-inline-btn")).toBeVisible();
  await expect(page.getByTestId("v2-result")).toHaveCount(0);

  // Accept this time
  await page.getByTestId("accept-inline-btn").click();
  await expect(page.getByTestId("v2-result")).toHaveText("ACCEPTED");
});
