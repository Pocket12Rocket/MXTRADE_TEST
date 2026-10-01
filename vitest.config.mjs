import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Why: Vitest runs unit and component tests (React Testing Library in jsdom); JSX lives in .js
// files, so the JSX transform is widened to .js.
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
