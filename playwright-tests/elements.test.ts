/**
 * Visual tests for HTML element rendering: plain elements, nested elements,
 * inline styles, and Fragments.
 */
import { expect, test } from "./fixtures";

test("renders a plain HTML element", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;
    render(
      createElement("h1", { id: "heading", className: "title" }, "Hello yract"),
      document.getElementById("root") as HTMLElement,
    );
  });

  await expect(page.locator("#heading")).toHaveText("Hello yract");
  await expect(page.locator("#heading")).toHaveClass("title");
  await page.screenshot({ path: "/tmp/visual-element.png" });
});

test("renders nested elements", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;
    render(
      createElement(
        "ul",
        { id: "list" },
        createElement("li", null, "Item 1"),
        createElement("li", null, "Item 2"),
        createElement("li", null, "Item 3"),
      ),
      document.getElementById("root") as HTMLElement,
    );
  });

  const items = page.locator("#list li");
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toHaveText("Item 1");
  await expect(items.nth(2)).toHaveText("Item 3");
  await page.screenshot({ path: "/tmp/visual-nested.png" });
});

test("Fragment renders multiple children without a wrapper", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, Fragment, render } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    function* App() {
      yield createElement(
        Fragment,
        null,
        createElement("p", { id: "p1" }, "First"),
        createElement("p", { id: "p2" }, "Second"),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.locator("#p1")).toHaveText("First");
  await expect(page.locator("#p2")).toHaveText("Second");
  await page.screenshot({ path: "/tmp/visual-fragment.png" });
});

test("inline styles are applied correctly", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    render(
      createElement(
        "div",
        {
          id: "styled",
          style: { backgroundColor: "blue", color: "white", padding: "8px" },
        },
        "Styled",
      ),
      document.getElementById("root") as HTMLElement,
    );
  });

  const el = page.locator("#styled");
  await expect(el).toHaveText("Styled");
  const bgColor = await el.evaluate((node: HTMLElement) => node.style.backgroundColor);
  expect(bgColor).toBe("blue");
  await page.screenshot({ path: "/tmp/visual-styles.png" });
});
