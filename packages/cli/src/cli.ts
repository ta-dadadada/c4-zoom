import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { parseArgs } from 'node:util';
import { buildHtml, type BuildOptions } from './buildHtml.js';

const usage = `c4-zoom build <workspace.json | -> [options]

  -o, --output <path>       出力パス（既定は入力名.html、標準入力では workspace.html）
  --prelayout              ELK の計算結果を埋め込む（既定）
  --no-prelayout           レイアウトをブラウザで計算する
  --overrides <path>       手動配置差分を含む JSON ファイル
  --title <title>          HTML のタイトル
  --theme <light|dark>     初期テーマ（既定は light）
  --allow-file-drop        出力 HTML で別の JSON を読み込めるようにする
  --strict                 警告がある入力を拒否する
  -h, --help               使い方を表示する`;

interface CliIo {
  stdin: AsyncIterable<Buffer>;
  stdout(message: string): void;
  stderr(message: string): void;
  loadTemplate(): Promise<string>;
}

async function loadViewerTemplate(): Promise<string> {
  try {
    const url = import.meta.resolve('@c4-zoom/viewer/viewer-template.html');
    return await readFile(new URL(url), 'utf8');
  } catch (error) {
    throw new Error('ビューアテンプレートを読み込めません。先に pnpm build を実行してください。', {
      cause: error,
    });
  }
}

const defaultIo: CliIo = {
  stdin: process.stdin,
  stdout: (message) => console.log(message),
  stderr: (message) => console.error(message),
  loadTemplate: loadViewerTemplate,
};

function parseCommand(args: string[]): BuildOptions | undefined {
  if (args.length === 0 || (args.length === 1 && ['--help', '-h'].includes(args[0]!))) return;
  const [command, ...flags] = args;
  if (command !== 'build') throw new Error('build コマンドを指定してください。');

  const { values, positionals } = parseArgs({
    args: flags,
    allowPositionals: true,
    allowNegative: true,
    options: {
      output: { type: 'string', short: 'o' },
      prelayout: { type: 'boolean', default: true },
      overrides: { type: 'string' },
      title: { type: 'string' },
      theme: { type: 'string', default: 'light' },
      'allow-file-drop': { type: 'boolean', default: false },
      strict: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) return;
  const [input] = positionals;
  if (!input || positionals.length !== 1) {
    throw new Error('workspace.json のパスまたは標準入力を表す - を一つ指定してください。');
  }
  if (values.theme !== 'light' && values.theme !== 'dark') {
    throw new Error('--theme には light または dark を指定してください。');
  }
  const stem = input === '-' ? 'workspace' : basename(input, extname(input));
  return {
    input,
    output: values.output ?? `${stem}.html`,
    prelayout: values.prelayout,
    overrides: values.overrides,
    title: values.title,
    theme: values.theme,
    allowFileDrop: values['allow-file-drop'],
    strict: values.strict,
  };
}

export async function runCli(args: string[], io: CliIo = defaultIo): Promise<number> {
  try {
    const options = parseCommand(args);
    if (!options) {
      io.stdout(usage);
      return 0;
    }
    const built = await buildHtml(options, {
      stdin: io.stdin,
      loadTemplate: io.loadTemplate,
      report({ severity, message, path, line, column }) {
        const location = path ?? (line === undefined ? undefined : `${line}:${column ?? 1}`);
        io.stderr(`${severity}${location ? ` (${location})` : ''}: ${message}`);
      },
    });
    return built ? 0 : 1;
  } catch (error) {
    io.stderr(`c4-zoom: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
