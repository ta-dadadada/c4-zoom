import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { conditions: ['c4-zoom-source', 'node'] },
  test: { include: ['packages/**/*.test.ts'] },
});
