import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Why: Vitest runs unit and component tests (React Testing Library in jsdom); JSX lives in .js
// files, so the JSX transform is widened to .js.
export default defineConfig({
  plugins: [react({ include: /\.(js|jsx)$/ })],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  oxc: {
    include: /\.(js|jsx)$/,
    exclude: [],
    lang: 'jsx',
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx,ts,tsx}'],
    css: false,
  },
});
