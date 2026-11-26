import { injectBootstrap, type C4ZoomBootstrapPayload } from '@c4-zoom/core/export';

export async function downloadHtml(
  mode: 'sample-site' | 'standalone',
  payload: C4ZoomBootstrapPayload,
) {
  let template: string;
  if (mode === 'standalone') {
    // 画面の描画結果は除き、CSP と元のインラインコードを保ったまま再出力する。
    const clone = document.documentElement.cloneNode(true) as HTMLElement;
    clone.querySelector('#root')?.replaceChildren();
    template = '<!doctype html>\n' + clone.outerHTML;
  } else {
    const response = await fetch(new URL('viewer-template.html', document.baseURI));
    if (!response.ok) throw new Error('単一 HTML テンプレートを読み込めませんでした。');
    template = await response.text();
  }
  const html = injectBootstrap(template, payload);
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const link = document.createElement('a');
  const basename = (payload.title ?? payload.workspace.name).replace(/[^\p{L}\p{N}._-]+/gu, '-');
  link.href = url;
  link.download = `${basename.replace(/^[.-]+|[.-]+$/g, '').slice(0, 100) || 'architecture'}.html`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
