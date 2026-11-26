import type { Offsets } from '../core/layout/types';
import type { ThemeName } from '../core/renderer/theme';
import type { Source } from './source';

const settingsKey = 'c4-zoom:settings:v1';
const sourceKey = 'c4-zoom:source:v1';
const layoutKey = (workspace: string) => `c4-zoom:layout:v1:${workspace}`;

function read(key: string): unknown {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : undefined;
  } catch {
    return undefined;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function storedTheme(): ThemeName {
  const data = read(settingsKey);
  return typeof data === 'object' && data !== null && 'theme' in data && data.theme === 'dark'
    ? 'dark'
    : 'light';
}

export function storedSource(): Source | undefined {
  const data = read(sourceKey);
  if (!data || typeof data !== 'object' || !('kind' in data)) return;
  if (data.kind === 'sample' && 'id' in data && typeof data.id === 'string')
    return { kind: 'sample', id: data.id };
  if (
    data.kind === 'file' &&
    'name' in data &&
    'text' in data &&
    typeof data.name === 'string' &&
    typeof data.text === 'string'
  ) {
    return { kind: 'file', name: data.name, text: data.text };
  }
}

export function workspaceKey(source: Source, name: string): string {
  // ファイル名とワークスペース名が同じモデルには、DSL の再読込時も位置差分を適用する。
  return JSON.stringify(
    source.kind === 'sample' ? ['sample', source.id] : ['file', source.name, name],
  );
}

export function storedOffsets(workspace: string): Offsets {
  const data = read(layoutKey(workspace));
  const offsets: Offsets = Object.create(null);
  if (!data || typeof data !== 'object') return offsets;
  for (const [id, value] of Object.entries(data)) {
    if (!value || typeof value !== 'object' || !('dx' in value) || !('dy' in value)) continue;
    const { dx, dy } = value;
    if (
      typeof dx === 'number' &&
      typeof dy === 'number' &&
      Number.isFinite(dx) &&
      Number.isFinite(dy)
    )
      offsets[id] = { dx, dy };
  }
  return offsets;
}

export const saveTheme = (theme: ThemeName) => write(settingsKey, { theme });
export const saveSource = (source: Source) => write(sourceKey, source);
export const saveOffsets = (workspace: string, offsets: Offsets) =>
  write(layoutKey(workspace), offsets);
