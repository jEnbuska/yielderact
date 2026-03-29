import type { Page } from "@playwright/test";

/** Navigate to the app and wait for it to be ready. */
export async function goToApp(page: Page) {
  await page.goto("/");
  await page.waitForSelector('[data-testid="app-heading"]');
}

/** Map of tab labels used in tests → their data-testid values. */
const tabIds: Record<string, string> = {
  Counter: "tab-counter",
  "Todo List": "tab-todos",
  "Context / Theme": "tab-theme",
  "Data Fetcher": "tab-data",
  useResolveRaw: "tab-raw",
  "Hooks Showcase": "tab-hooks",
  "$shown prop": "tab-shown",
  useRender: "tab-confirm",
  useEffect: "tab-effect",
  // "UI Patch": "tab-transition", // TODO: Restore when $patch is re-implemented (#163)
  "Context Scoping": "tab-context",
  "Lazy Context": "tab-lazy-ctx",
  "AbortSignal Effect": "tab-abort-signal",
  "Key Shuffle": "tab-key-shuffle",
  "$deps prop": "tab-deps",
  createPortal: "tab-portal",
  "Slot API": "tab-slot",
};

/** Click the tab with the given label. */
export async function clickTab(page: Page, label: string) {
  await page.getByTestId(tabIds[label]).click();
}
