import type { LayoutOverrides, PositionedGraph } from '../layout/types.js';
import type { C4Level, C4Workspace } from '../model/types.js';
import type { ThemeName } from '../renderer/theme.js';

export { parseLayoutOverrides, workspaceHash } from './layoutOverrides.js';

export const bootstrapId = 'c4-zoom-bootstrap';

export interface C4ZoomBootstrapPayload {
  schemaVersion: 1;
  mode: 'standalone' | 'sample-site';
  title?: string;
  workspace: C4Workspace;
  precomputedLayout?: PositionedGraph;
  layoutOverrides?: LayoutOverrides;
  initialCamera?: {
    level?: C4Level;
    focusElementId?: string;
  };
  theme?: ThemeName;
  allowFileDrop?: boolean;
  allowHtmlExport?: boolean;
}

const jsonEscapes: Record<string, string> = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
};

const titleEscapes: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function serializeBootstrap(payload: C4ZoomBootstrapPayload): string {
  // JSON の文字列境界と HTML の script 要素境界をそれぞれ守る。
  return JSON.stringify(payload).replace(/[<>&\u2028\u2029]/g, (char) => jsonEscapes[char]!);
}

function replaceSlot(html: string, open: string, close: string, value: string): string {
  const start = html.indexOf(open);
  const contentStart = start + open.length;
  const end = html.indexOf(close, contentStart);
  if (start < 0 || end < 0) throw new Error(`HTML テンプレートに ${open} がありません。`);
  return html.slice(0, contentStart) + value + html.slice(end);
}

export function injectBootstrap(template: string, payload: C4ZoomBootstrapPayload): string {
  const title = (payload.title ?? payload.workspace.name).replace(
    /[&<>"']/g,
    (char) => titleEscapes[char]!,
  );
  const html = replaceSlot(template, '<title>', '</title>', title);
  return replaceSlot(
    html,
    `<script id="${bootstrapId}" type="application/json">`,
    '</script>',
    serializeBootstrap(payload),
  );
}
