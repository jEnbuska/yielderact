import { defineConfig } from 'vite';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import { yielderactPlugin } from '../vite-plugin-yielderact';

export default defineConfig({
  plugins: [yielderactPlugin(), tailwindcss()],
  resolve: {
    // Resolve yielderact to source files so you don't need a separate build step.
    // jsx-dev-runtime is an alias for jsx-runtime because yielderact exports
    // jsxDEV from the same module (Vite's dev mode requests the dev runtime path).
    alias: {
      'yielderact/jsx-dev-runtime': path.resolve(__dirname, '../src/jsx-runtime.ts'),
      'yielderact/jsx-runtime': path.resolve(__dirname, '../src/jsx-runtime.ts'),
      yielderact: path.resolve(__dirname, '../src/index.ts'),
    },
  },
});
