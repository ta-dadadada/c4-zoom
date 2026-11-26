import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Plugin } from 'vite';

export const licenseAsset = 'THIRD-PARTY-LICENSES.md';

async function licenseText(dependencies: string): Promise<string> {
  // Tailwind の CSS は JS モジュールとして集計されないため、配布物にライセンスを追加する。
  const resolve = createRequire(import.meta.url).resolve;
  const tailwindDir = dirname(resolve('tailwindcss/package.json'));
  const [project, tailwind, samples] = await Promise.all([
    readFile(new URL('../../LICENSE', import.meta.url), 'utf8'),
    readFile(join(tailwindDir, 'LICENSE'), 'utf8'),
    readFile(
      new URL('../../fixtures/dsl/upstream/LICENSE-Apache-2.0.txt', import.meta.url),
      'utf8',
    ),
  ]);

  return `# c4-zoom

${project}

${dependencies.trim()}

elkjs のソースコード: https://github.com/kieler/elkjs
Eclipse Layout Kernel のソースコード: https://github.com/eclipse-elk/elk

## Tailwind CSS

${tailwind}

## Structurizr 公式サンプル

Structurizr の公式サンプルを含む出力には、次のライセンスが適用されます。
出典: https://github.com/structurizr/java

${samples}`;
}

export function bundleLicenses(standalone: boolean): Plugin {
  return {
    name: 'c4-zoom:bundle-licenses',
    enforce: 'post',
    generateBundle: {
      order: 'post',
      async handler(_options, bundle) {
        const license = bundle[licenseAsset];
        if (license?.type !== 'asset' || typeof license.source !== 'string') {
          this.error('Vite が生成した配布ライセンス一覧が見つかりません。');
        }
        const notices = await licenseText(license.source);
        if (standalone) {
          const template = bundle['viewer-template.html'];
          if (template?.type !== 'asset' || typeof template.source !== 'string') {
            this.error('ライセンスを挿入する HTML テンプレートが見つかりません。');
          }
          const safe = notices
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;');
          template.source = template.source.replace(
            '</head>',
            `  <template id="c4-zoom-licenses"><pre>\n${safe}</pre></template>\n  </head>`,
          );
          delete bundle[licenseAsset];
        } else {
          license.source = notices;
        }
      },
    },
  };
}
