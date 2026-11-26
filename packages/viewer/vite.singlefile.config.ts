import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { bundleLicenses, licenseAsset } from './vite.licenses.ts';
import { viewerConfig } from './vite.shared.ts';

function standaloneCsp(): Plugin {
  return {
    name: 'c4-zoom:standalone-csp',
    enforce: 'post',
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const filename = 'viewer-template.html';
        const template = bundle[filename];
        if (
          Object.keys(bundle).length !== 1 ||
          template?.type !== 'asset' ||
          typeof template.source !== 'string'
        ) {
          this.error('単一 HTML ビルドから外部アセットを除去できませんでした。');
        }
        // HTML パーサーで改行が正規化されるため、実行時のハッシュも LF を基準にする。
        const script = /<script type="module"[^>]*>([\s\S]*?)<\/script>/.exec(template.source)?.[1];
        if (!script) this.error('単一 HTML にインラインスクリプトが見つかりません。');
        const hash = createHash('sha256').update(script.replace(/\r\n?/g, '\n')).digest('base64');
        const policy = `default-src 'none'; base-uri 'none'; form-action 'none'; script-src 'sha256-${hash}'; style-src 'unsafe-inline'; img-src data:`;
        template.source = template.source.replace(
          '<meta charset="UTF-8" />',
          `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
        );
      },
    },
  };
}

export default defineConfig(
  mergeConfig(viewerConfig(), {
    publicDir: false,
    build: {
      outDir: 'dist/template',
      license: { fileName: licenseAsset },
      modulePreload: false,
      rolldownOptions: {
        input: fileURLToPath(new URL('./viewer-template.html', import.meta.url)),
      },
    },
    plugins: [bundleLicenses(true), viteSingleFile(), standaloneCsp()],
  }),
);
