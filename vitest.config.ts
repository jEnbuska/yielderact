import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "yract",
  },
  resolve: {
    alias: {
      "yract/jsx-dev-runtime": resolve(__dirname, "src/jsx-runtime.ts"),
      "yract/jsx-runtime": resolve(__dirname, "src/jsx-runtime.ts"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/__tests__/**/*.test.{ts,tsx}"],
  },
});
