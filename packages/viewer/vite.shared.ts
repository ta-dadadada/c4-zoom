import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { UserConfig } from 'vite';

export function viewerConfig(): UserConfig {
  return {
    base: './',
    resolve: { conditions: ['c4-zoom-source', 'module', 'browser', 'development|production'] },
    plugins: [react(), tailwindcss()],
    server: {
      fs: {
        deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.local/**', '**/*.local.md'],
      },
    },
  };
}
