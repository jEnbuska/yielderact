import path from "node:path";
import { defineConfig } from "vite";

/**
 * Vite config for the yract-beta playground.
 *
 * - Tells Vite's JSX transform (oxc) to import the JSX helpers from
 *   `yract-beta/jsx-runtime`.
 * - Aliases `yract-beta` to the local `../src` so the playground runs
 *   directly against beta source — no separate build step.
 */
export default defineConfig({
  oxc: {
    jsxImportSource: "yract-beta",
  },
  resolve: {
    alias: {
      "yract-beta/jsx-dev-runtime": path.resolve(__dirname, "../src/jsx-runtime.ts"),
      "yract-beta/jsx-runtime": path.resolve(__dirname, "../src/jsx-runtime.ts"),
      "yract-beta": path.resolve(__dirname, "../src/index.ts"),
    },
  },
  test: {
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
