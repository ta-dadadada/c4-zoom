import { execFileSync } from 'node:child_process';

const diffOptions = ['--cached', '--no-renames', '--ignore-submodules=none'];
// 正規表現を記述したこのファイルもステージされるため、ドットは文字クラスで表す。
const privatePath = /(?:^|\/)[.]local(?:\/|$)|[.]local[.]md$/i;
const privateReference = /(?:^|[^\w.-])[.]local[/\\]|[.]local[.]md\b/i;
const unixPath =
  /(?:^|[^\w./-]|file:\/\/)\/(?:Users|home|root|(?:private\/)?var\/folders|private\/tmp)\/\S/;
const windowsPath = /\b[A-Z]:[/\\]+(?:Users|Documents and Settings)[/\\]+\S/i;

function gitDiff(args) {
  return execFileSync('git', ['--literal-pathspecs', 'diff', ...diffOptions, ...args], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
}

function stripAllowedReferences(path, line) {
  if (
    path === 'fixtures/dsl/upstream/spring-petclinic.dsl' &&
    /^\s*\/\/ - Value: the full path to the location of the spring-petclinic example \(e\.g\. \/Users\/simon\/spring-petclinic\)$/.test(
      line,
    )
  ) {
    return '';
  }
  // 開発サーバーでのアクセス拒否に使う、既知のグロブを除外する。
  if (path === 'packages/viewer/vite.shared.ts') {
    return line.replace(/\*\*\/[.]local\/\*\*|\*\*\/\*[.]local[.]md/g, '');
  }
  return line;
}

function inspectStaged() {
  const issues = [];
  const paths = gitDiff(['--name-only', '-z', '--diff-filter=ACMRT']).split('\0').filter(Boolean);
  for (const path of paths) {
    const label = JSON.stringify(path);
    if (privatePath.test(path)) {
      issues.push(label + ' 非公開ファイルがステージされています。');
      continue;
    }
    const patch = gitDiff(['--no-color', '--no-ext-diff', '--no-textconv', '-U0', '--', path]);
    let lineNumber = 0;
    for (const line of patch.split('\n')) {
      if (line.startsWith('@@ ')) {
        lineNumber = Number(/ \+(\d+)/.exec(line)?.[1]);
      } else if (lineNumber && line.startsWith('+')) {
        const content = stripAllowedReferences(path, line.slice(1).replace(/\r$/, ''));
        if (privateReference.test(content)) {
          issues.push(label + ' ' + lineNumber + ' 行目に非公開ファイルへの参照があります。');
        }
        if (unixPath.test(content) || windowsPath.test(content)) {
          issues.push(label + ' ' + lineNumber + ' 行目にローカル絶対パスがあります。');
        }
        lineNumber++;
      } else if (lineNumber && line.startsWith(' ')) {
        lineNumber++;
      }
    }
  }
  return issues;
}

try {
  const issues = inspectStaged();
  if (issues.length) {
    console.error(issues.join('\n'));
    process.exitCode = 1;
  }
} catch {
  console.error('ステージ済み差分の安全検査を実行できませんでした。');
  process.exitCode = 1;
}
