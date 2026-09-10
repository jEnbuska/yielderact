import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: {
    jsx: {
      runtime: "automatic",
      importSource: "yract-beta",
      development: false, // jsxDEV → jsx / jsxs
    },
  },
  resolve: {
    alias: {
      "yract-beta/jsx-dev-runtime": resolve(__dirname, "src/jsx-runtime.ts"),
      "yract-beta/jsx-runtime": resolve(__dirname, "src/jsx-runtime.ts"),
      "yract-beta": resolve(__dirname, "src/index.ts"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/__tests__/**/*.test.{ts,tsx}"],
  },
});
