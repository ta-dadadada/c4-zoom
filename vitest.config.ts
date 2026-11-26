import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const coreSrc = fileURLToPath(new URL('./packages/core/src', import.meta.url));

export default defineConfig({
  resolve: {
    conditions: ['c4-zoom-source', 'node'],
    alias: [
      { find: '@c4-zoom/core/json', replacement: `${coreSrc}/json/index.ts` },
      { find: '@c4-zoom/core/export', replacement: `${coreSrc}/export/index.ts` },
      { find: /^@c4-zoom\/core\/(.+)$/, replacement: `${coreSrc}/$1.ts` },
    ],
  },
  test: { include: ['packages/**/*.test.ts'] },
});
