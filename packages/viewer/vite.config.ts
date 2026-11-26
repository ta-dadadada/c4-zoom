import { readFile } from 'node:fs/promises';
import { defineConfig, mergeConfig, type Plugin } from 'vite';
import { bundleLicenses, licenseAsset } from './vite.licenses.ts';
import { viewerConfig } from './vite.shared.ts';

function serveTemplate(): Plugin {
  const file = new URL('./dist/template/viewer-template.html', import.meta.url);
  return {
    name: 'c4-zoom:serve-template',
    configureServer(server) {
      server.middlewares.use('/viewer-template.html', (_request, response, next) => {
        void readFile(file).then(
          (template) => {
            response.setHeader('Content-Type', 'text/html; charset=utf-8');
            response.end(template);
          },
          (error: unknown) => next(error),
        );
      });
    },
  };
}

export default defineConfig(
  mergeConfig(viewerConfig(), {
    build: { outDir: 'dist/site', license: { fileName: licenseAsset } },
    plugins: [
      serveTemplate(),
      bundleLicenses(false),
      {
        name: 'c4-zoom:site-csp',
        apply: 'build',
        transformIndexHtml: {
          order: 'pre',
          handler: () => [
            {
              tag: 'meta',
              attrs: {
                'http-equiv': 'Content-Security-Policy',
                content:
                  "default-src 'none'; base-uri 'none'; form-action 'none'; script-src 'self'; style-src 'self'; img-src data:; worker-src 'self'; connect-src 'self'",
              },
              injectTo: 'head-prepend',
            },
          ],
        },
      } satisfies Plugin,
    ],
  }),
);
