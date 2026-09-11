import path from "node:path";
import { defineConfig } from "vite";

/**
 * Vite config for the yract playground.
 *
 * - Tells Vite's JSX transform (oxc) to import the JSX helpers from
 *   `yract/jsx-runtime`.
 * - Aliases `yract` to the local `../src` so the playground runs
 *   directly against beta source — no separate build step.
 */
export default defineConfig({
  oxc: {
    jsxImportSource: "yract",
  },
  resolve: {
    alias: {
      "yract/jsx-dev-runtime": path.resolve(__dirname, "../src/jsx-runtime.ts"),
      "yract/jsx-runtime": path.resolve(__dirname, "../src/jsx-runtime.ts"),
      yract: path.resolve(__dirname, "../src/index.ts"),
    },
  },
  test: {
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
