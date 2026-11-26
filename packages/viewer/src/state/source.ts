import type { WorkspaceDiagnostic } from '@c4-zoom/core/json';
import type { Sample } from '../viewer';

export type Source =
  | { kind: 'sample'; id: string }
  | { kind: 'file'; name: string; text: string }
  | { kind: 'embedded'; name: string };

export function sourceName(source: Source, samples: readonly Sample[]): string {
  return source.kind === 'sample'
    ? (samples.find((sample) => sample.id === source.id)?.name ?? 'サンプル')
    : source.name;
}

export function loadDiagnostic(message: string): WorkspaceDiagnostic {
  return { severity: 'error', message };
}
