import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "transform",
    jsxFactory: "createElement",
    jsxFragment: "Fragment",
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/__tests__/**/*.test.ts"],
  },
});
