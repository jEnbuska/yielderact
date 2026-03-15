/**
 * Shared Playwright fixtures for yract visual tests.
 *
 * Bundles the library once per worker via esbuild and provides a
 * `setupPage` helper that injects the bundle into any blank page.
 */
import { test as base } from "@playwright/test";
import { build } from "esbuild";
import * as path from "path";

let bundleCode = "";

/**
 * Extended test instance that exposes `setupPage` as a fixture.
 */
export const test = base.extend<{ setupPage: () => Promise<void> }>({
  setupPage: async ({ page }, use) => {
    const setup = async () => {
      await page.setContent('<!DOCTYPE html><html><body><div id="root"></div></body></html>');
      await page.addScriptTag({ content: bundleCode });
    };
    await use(setup);
  },
});

test.beforeAll(async () => {
  const result = await build({
    entryPoints: [path.join(__dirname, "../src/index.ts")],
    bundle: true,
    format: "iife",
    globalName: "Yielderact",
    write: false,
    tsconfig: path.join(__dirname, "../tsconfig.json"),
    logLevel: "error",
  });
  bundleCode = result.outputFiles[0].text;
});

export { expect } from "@playwright/test";
