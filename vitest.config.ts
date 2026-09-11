import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: {
    jsx: {
      runtime: "automatic",
      importSource: "yract",
      development: false, // jsxDEV → jsx / jsxs
    },
  },
  resolve: {
    alias: {
      "yract/jsx-dev-runtime": resolve(__dirname, "src/jsx-runtime.ts"),
      "yract/jsx-runtime": resolve(__dirname, "src/jsx-runtime.ts"),
      yract: resolve(__dirname, "src/index.ts"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/__tests__/**/*.test.{ts,tsx}"],
  },
});
