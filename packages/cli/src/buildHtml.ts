import { createReadStream } from 'node:fs';
import { mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import {
  injectBootstrap,
  parseLayoutOverrides,
  type C4ZoomBootstrapPayload,
} from '@c4-zoom/core/export';
import {
  maxWorkspaceJsonBytes,
  parseStructurizrWorkspaceJson,
  type WorkspaceDiagnostic,
} from '@c4-zoom/core/json';
import { layoutWorkspace } from '@c4-zoom/core/layout/elkLayout';
import type { ThemeName } from '@c4-zoom/core/renderer/theme';

export interface BuildOptions {
  input: string;
  output: string;
  prelayout: boolean;
  overrides?: string;
  title?: string;
  theme: ThemeName;
  allowFileDrop: boolean;
  strict: boolean;
}

interface BuildContext {
  stdin: AsyncIterable<Buffer>;
  loadTemplate(): Promise<string>;
  report(diagnostic: WorkspaceDiagnostic): void;
}

async function readJson(input: AsyncIterable<Buffer>): Promise<string> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of input) {
    bytes += chunk.length;
    if (bytes > maxWorkspaceJsonBytes) {
      throw new Error(
        `JSON ファイルがサイズ上限（${maxWorkspaceJsonBytes} バイト）を超えています。`,
      );
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, bytes).toString('utf8');
}

async function writeHtml(output: string, html: string): Promise<void> {
  const tempDir = await mkdtemp(join(dirname(output), '.c4-zoom-'));
  try {
    const tempFile = join(tempDir, 'architecture.html');
    await writeFile(tempFile, html, 'utf8');
    await rename(tempFile, output);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function buildHtml(options: BuildOptions, context: BuildContext): Promise<boolean> {
  const output = resolve(options.output);
  if (
    (options.input !== '-' && output === resolve(options.input)) ||
    (options.overrides && output === resolve(options.overrides))
  ) {
    throw new Error('出力パスには入力ファイルと別のパスを指定してください。');
  }

  const text = await readJson(
    options.input === '-' ? context.stdin : createReadStream(options.input),
  );
  const { workspace, diagnostics } = parseStructurizrWorkspaceJson(text);
  for (const diagnostic of diagnostics) context.report(diagnostic);
  if (
    !workspace ||
    diagnostics.some(
      ({ severity }) => severity === 'error' || (options.strict && severity === 'warning'),
    )
  ) {
    return false;
  }

  const layoutOverrides = options.overrides
    ? parseLayoutOverrides(
        JSON.parse((await readJson(createReadStream(options.overrides))).replace(/^\uFEFF/, '')),
        workspace,
      )
    : undefined;
  const template = await context.loadTemplate();
  const payload: C4ZoomBootstrapPayload = {
    schemaVersion: 1,
    mode: 'standalone',
    title: options.title,
    workspace,
    precomputedLayout: options.prelayout ? await layoutWorkspace(workspace) : undefined,
    layoutOverrides,
    theme: options.theme,
    allowFileDrop: options.allowFileDrop,
  };
  await writeHtml(output, injectBootstrap(template, payload));
  return true;
}
