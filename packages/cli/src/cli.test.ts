import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { C4ZoomBootstrapPayload } from '@c4-zoom/core/export';
import { applyOffsets } from '@c4-zoom/core/layout/offsets';
import { afterEach, expect, it, vi } from 'vitest';
import { runCli } from './cli.js';

const template = `<!doctype html><title>Viewer</title>
<script id="c4-zoom-bootstrap" type="application/json"></script>`;
const example = {
  name: 'Demo',
  model: { softwareSystems: [{ id: '1', name: 'Inventory' }] },
};

const tempDirs: string[] = [];
afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function setup(input: unknown = example) {
  const dir = await mkdtemp(join(tmpdir(), 'c4-zoom-test-'));
  tempDirs.push(dir);
  const source = join(dir, 'workspace.json');
  const output = join(dir, 'test.html');
  await writeFile(source, JSON.stringify(input));
  const io = {
    stdin: (async function* () {
      yield Buffer.from(JSON.stringify(input));
    })(),
    stdout: vi.fn(),
    stderr: vi.fn(),
    loadTemplate: vi.fn(async () => template),
  };
  return { dir, source, output, io };
}

function readPayload(html: string): C4ZoomBootstrapPayload {
  const json = html.match(
    /<script id="c4-zoom-bootstrap" type="application\/json">([^<]*)<\/script>/,
  );
  if (!json?.[1]) throw new Error('ブートストラップ JSON がありません。');
  return JSON.parse(json[1]) as C4ZoomBootstrapPayload;
}

it('builds an offline HTML with base precomputed layout and applies offsets once', async () => {
  const { dir, source, output, io } = await setup();
  const overrides = join(dir, 'overrides.json');
  const offsets = { '1': { dx: 20, dy: -12 } };
  await writeFile(overrides, JSON.stringify(offsets));
  expect(await runCli(['build', source, '-o', output], io)).toBe(0);
  const base = readPayload(await readFile(output, 'utf8')).precomputedLayout;
  expect(base?.nodes['1']?.width).toBeGreaterThan(0);

  expect(
    await runCli(['build', source, '--prelayout', '-o', output, '--overrides', overrides], io),
  ).toBe(0);
  const payload = readPayload(await readFile(output, 'utf8'));
  expect(payload).toMatchObject({ mode: 'standalone', workspace: { name: 'Demo' } });
  expect(payload.layoutOverrides?.offsets).toEqual(offsets);
  expect(payload.precomputedLayout).toEqual(base);
  expect(
    applyOffsets(payload.precomputedLayout!, payload.layoutOverrides!.offsets).nodes['1'],
  ).toMatchObject({ x: base!.nodes['1']!.x + 20, y: base!.nodes['1']!.y - 12 });
});

it('takes stdin and respects title, theme, file drop, and deferred layout', async () => {
  const { output, io } = await setup();
  expect(
    await runCli(
      [
        'build',
        '-',
        '--output',
        output,
        '--no-prelayout',
        '--title',
        'Demo & notes',
        '--theme',
        'dark',
        '--allow-file-drop',
      ],
      io,
    ),
  ).toBe(0);

  const html = await readFile(output, 'utf8');
  expect(html).toContain('<title>Demo &amp; notes</title>');
  const payload = readPayload(html);
  expect(payload).toMatchObject({
    theme: 'dark',
    allowFileDrop: true,
    workspace: { name: 'Demo' },
  });
  expect(payload).not.toHaveProperty('precomputedLayout');
});

it('preserves existing output on strict warning and missing model', async () => {
  const { source, output, io } = await setup({
    model: { softwareSystems: [{ id: '1' }] },
  });
  await writeFile(output, 'prior output');
  expect(await runCli(['build', source, '-o', output, '--strict'], io)).toBe(1);
  expect(io.stderr).toHaveBeenCalledWith(expect.stringMatching(/^warning/));
  expect(await readFile(output, 'utf8')).toBe('prior output');
  expect(io.loadTemplate).not.toHaveBeenCalled();
  expect(await runCli(['build', source, '-o', output], io)).toBe(0);

  const priorHtml = await readFile(output, 'utf8');
  await writeFile(source, '{"name":"Invalid"}');
  expect(await runCli(['build', source, '-o', output], io)).toBe(1);
  expect(io.stderr).toHaveBeenCalledWith(expect.stringMatching(/^error/));
  expect(await readFile(output, 'utf8')).toBe(priorHtml);
});

it('handles help and invalid arguments before reading the model or writing output', async () => {
  const { source, io } = await setup();
  const original = await readFile(source, 'utf8');
  expect(await runCli(['build', '--help'], io)).toBe(0);
  expect(io.stdout).toHaveBeenCalledWith(expect.stringContaining('--no-prelayout'));
  expect(await runCli(['build', source, '-o', source], io)).toBe(1);
  expect(await readFile(source, 'utf8')).toBe(original);
  expect(await runCli(['build', source, '--theme', 'blue'], io)).toBe(1);
  expect(io.loadTemplate).not.toHaveBeenCalled();
});
