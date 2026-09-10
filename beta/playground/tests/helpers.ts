import type { Page } from "@playwright/test";

/** Navigate to the app and wait for it to be ready. */
export async function goToApp(page: Page) {
  await page.goto("/");
  await page.waitForSelector('[data-testid="app-tablist"]');
}

/** Demo labels used in tests → the id of their section. */
const demoIds: Record<string, string> = {
  Counter: "counter",
  "Todo List": "todos",
  "Hooks Showcase": "hooks",
  useEffect: "effect",
  "Context Scoping": "context",
  "Lazy Context": "lazy-ctx",
  "Key Shuffle": "key-shuffle",
  "Defer Table": "deferred",
  Await: "await",
  "DOS Kit": "dos",
};

/**
 * Jump to a demo's section.
 *
 * Every demo is mounted at once now, so this only scrolls — assertions would
 * pass without it. It stays so specs read the same as when each demo was its
 * own route.
 */
export async function clickTab(page: Page, label: string) {
  const id = demoIds[label];
  if (!id) throw new Error(`Unknown demo "${label}". Known: ${Object.keys(demoIds).join(", ")}`);
  await page.getByTestId(`tab-${id}`).click();
  await page.locator(`#${id}`).scrollIntoViewIfNeeded();
}
