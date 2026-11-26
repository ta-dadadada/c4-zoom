import type { DslDiagnostic } from '../core/model/types';
import { samples } from '../samples';

export type Source = { kind: 'sample'; id: string } | { kind: 'file'; name: string; text: string };

export function sourceName(source: Source): string {
  return source.kind === 'sample'
    ? (samples.find((sample) => sample.id === source.id)?.name ?? 'サンプル')
    : source.name;
}

export function loadDiagnostic(message: string): DslDiagnostic {
  return { severity: 'error', message, line: 1, column: 1 };
}
