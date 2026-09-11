import { describe, expect, it } from "vitest";
import { createContext, render, useContext, useState } from "yract-beta";

/**
 * Wait for the scheduler to drain. Components mount synchronously but their
 * generator bodies run in the primary queue, which is driven by an awaited
 * Promise — a handful of microtask ticks is enough to settle initial mount.
 */
async function flush(ticks = 4): Promise<void> {
  for (let i = 0; i < ticks; i++) {
    await Promise.resolve();
  }
}

describe("smoke: elements", () => {
  it("renders a simple element into a container", async () => {
    const container = document.createElement("div");
    render(<div id="hello">hi</div>, container);
    await flush();
    expect(container.querySelector("#hello")?.textContent).toBe("hi");
  });

  it("applies a style prop object to el.style", async () => {
    const container = document.createElement("div");
    render(
      <div data-testid="styled" style={{ color: "rgb(255, 0, 0)", paddingLeft: "4px" }}>
        styled
      </div>,
      container,
    );
    await flush();
    const el = container.querySelector<HTMLDivElement>('[data-testid="styled"]');
    expect(el).not.toBeNull();
    expect(el?.style.color).toBe("rgb(255, 0, 0)");
    expect(el?.style.paddingLeft).toBe("4px");
  });
});

describe("smoke: components", () => {
  it("renders a component's JSX output", async () => {
    function* Greeting(props: { name: string }) {
      return <p data-testid="greeting">Hello, {props.name}!</p>;
    }

    const container = document.createElement("div");
    render(<Greeting name="world" />, container);
    await flush();
    expect(container.querySelector('[data-testid="greeting"]')?.textContent).toBe("Hello, world!");
  });

  it("renders state from $state on initial mount", async () => {
    function* Counter() {
      const [count] = yield* useState(7);
      return <span data-testid="count">{count}</span>;
    }

    const container = document.createElement("div");
    render(<Counter />, container);
    await flush();
    expect(container.querySelector('[data-testid="count"]')?.textContent).toBe("7");
  });
});

describe("smoke: context", () => {
  it("consumer reads the provider value via $context", async () => {
    const ThemeCtx = createContext<"light" | "dark">("light");

    function* Badge() {
      const theme = yield* useContext(ThemeCtx);
      return <span data-testid="badge">{theme}</span>;
    }

    const container = document.createElement("div");
    render(
      <ThemeCtx value="dark">
        <Badge />
      </ThemeCtx>,
      container,
    );
    await flush();
    expect(container.querySelector('[data-testid="badge"]')?.textContent).toBe("dark");
  });

  it("falls back to the context default when no provider is present", async () => {
    const LocaleCtx = createContext<"en" | "fi">("en");

    function* Locale() {
      const locale = yield* useContext(LocaleCtx);
      return <span data-testid="locale">{locale}</span>;
    }

    const container = document.createElement("div");
    render(<Locale />, container);
    await flush();
    expect(container.querySelector('[data-testid="locale"]')?.textContent).toBe("en");
  });

  it("nested providers shadow outer values", async () => {
    const ThemeCtx = createContext<"light" | "dark">("light");

    function* Badge() {
      const theme = yield* useContext(ThemeCtx);
      return <span data-testid="badge">{theme}</span>;
    }

    const container = document.createElement("div");
    render(
      <ThemeCtx value="dark">
        <ThemeCtx value="light">
          <Badge />
        </ThemeCtx>
      </ThemeCtx>,
      container,
    );
    await flush();
    expect(container.querySelector('[data-testid="badge"]')?.textContent).toBe("light");
  });
});
