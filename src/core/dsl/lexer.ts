import type { DslDiagnostic, SourceRange } from '../model/types';

export interface Token extends SourceRange {
  kind: 'word' | 'string' | '{' | '}' | '=' | '->' | 'line' | 'eof';
  value: string;
}

export function lex(text: string): { tokens: Token[]; diagnostics: DslDiagnostic[] } {
  text = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  let i = 0;
  let line = 1;
  let column = 1;
  const tokens: Token[] = [];
  const diagnostics: DslDiagnostic[] = [];
  const position = () => ({ line, column });

  function take() {
    const ch = text[i++]!;
    if (ch === '\n') {
      line++;
      column = 1;
    } else column++;
    return ch;
  }

  function isStyleColor() {
    const previous = tokens.at(-1);
    return (
      previous?.kind === 'word' &&
      /^(color|colour|background|stroke)$/i.test(previous.value) &&
      /^#[\da-f]{3,8}(?=[\s}]|$)/i.test(text.slice(i))
    );
  }

  while (i < text.length) {
    const start = position();
    const emit = (kind: Token['kind'], value: string) => {
      tokens.push({ kind, value, start, end: position() });
    };
    const ch = text[i]!;
    if (ch === '\n' || ch === ';') {
      emit('line', take());
    } else if (/\s/.test(ch)) {
      take();
    } else if (text.startsWith('//', i) || (ch === '#' && !isStyleColor())) {
      while (i < text.length && text[i] !== '\n') take();
    } else if (text.startsWith('/*', i)) {
      take();
      take();
      while (i < text.length && !text.startsWith('*/', i)) {
        if (text[i] === '\n')
          tokens.push({
            kind: 'line',
            value: '\n',
            start: position(),
            end: { line: line + 1, column: 1 },
          });
        take();
      }
      if (i === text.length)
        diagnostics.push({
          severity: 'error',
          message: 'ブロックコメントが閉じられていません。',
          ...start,
        });
      else {
        take();
        take();
      }
    } else if (ch === '"') {
      take();
      let value = '';
      while (i < text.length && text[i] !== '"' && text[i] !== '\n') {
        const char = take();
        if (char === '\\' && i < text.length && text[i] !== '\n') {
          const escaped = take();
          if (escaped === '"' || escaped === '\\') value += escaped;
          else if (escaped === 'n') value += '\n';
          else if (escaped === 't') value += '\t';
          else value += '\\' + escaped;
        } else value += char;
      }
      if (text[i] === '"') take();
      else
        diagnostics.push({ severity: 'error', message: '文字列が閉じられていません。', ...start });
      emit('string', value);
    } else if (ch === '{' || ch === '}' || ch === '=') {
      emit(ch, take());
    } else if (text.startsWith('->', i)) {
      take();
      take();
      emit('->', '->');
    } else {
      const startIndex = i;
      do {
        take();
      } while (
        i < text.length &&
        !/[\s{}=";]/.test(text[i]!) &&
        !text.startsWith('->', i) &&
        !text.startsWith('/*', i)
      );
      emit('word', text.slice(startIndex, i));
    }
  }

  tokens.push({ kind: 'eof', value: '', start: position(), end: position() });
  return { tokens, diagnostics };
}
