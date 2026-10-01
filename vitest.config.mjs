import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { transformWithOxc } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Parses .js files as JSX before the default TS/TSX handling sees them.
 *
 * Why: Existing pages put JSX in .js files, and Vite parses .js as plain JavaScript.
 * @returns {import('vite').Plugin} The Vite plugin.
 */
function jsxInJs() {
  return {
    name: 'jsx-in-js',
    enforce: 'pre',
    transform(code, id) {
      if (!/\.js$/.test(id) || id.includes('node_modules')) return null;
      return transformWithOxc(code, id, { lang: 'jsx' });
    },
  };
}

// Why: Vitest runs unit and component tests (React Testing Library in jsdom); JSX lives in .js
// files too, so the JSX transform is widened to .js alongside .ts and .tsx.
export default defineConfig({
  plugins: [jsxInJs(), react({ include: /\.(js|jsx|ts|tsx)$/ })],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{js,jsx,ts,tsx}'],
    css: false,
  },
});
