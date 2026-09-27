import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Why: Vitest runs unit tests for lib/ and component tests (React Testing Library in jsdom).
// This repo keeps JSX in .js files (Next.js convention), so the JSX transform is widened to .js.
// Playwright (via MCP) remains the end-to-end check against the running app.
export default defineConfig({
  plugins: [react({ include: /\.(js|jsx)$/ })],
  oxc: {
    include: /\.(js|jsx)$/,
    exclude: [],
    lang: 'jsx',
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
    css: false,
  },
});
