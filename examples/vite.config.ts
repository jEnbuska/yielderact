import path from "path";
import { defineConfig } from "vite";
import { yractPlugin } from "../vite-plugin-yract";

export default defineConfig({
  plugins: [yractPlugin()],
  resolve: {
    // Resolve yract to source files so you don't need a separate build step.
    // jsx-dev-runtime is an alias for jsx-runtime because yract exports
    // jsxDEV from the same module (Vite's dev mode requests the dev runtime path).
    alias: {
      "yract/jsx-dev-runtime": path.resolve(__dirname, "../src/jsx-runtime.ts"),
      "yract/jsx-runtime": path.resolve(__dirname, "../src/jsx-runtime.ts"),
      yract: path.resolve(__dirname, "../src/index.ts"),
    },
  },
});
