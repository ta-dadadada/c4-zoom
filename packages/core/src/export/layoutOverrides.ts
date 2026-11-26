import type { LayoutOverrides, Offsets } from '../layout/types.js';
import type { C4Workspace } from '../model/types.js';

export function workspaceHash(workspace: C4Workspace): string {
  // 配置を決めるモデル構造から識別子を作る。同じ JSON の整形差には影響されない。
  const identity = JSON.stringify([
    workspace.name,
    workspace.rootIds,
    Object.values(workspace.elements).map(({ id, kind, name, childrenIds }) => [
      id,
      kind,
      name,
      childrenIds,
    ]),
    workspace.relationships.map(({ sourceId, targetId }) => [sourceId, targetId]),
  ]);
  let hash = 0xcbf29ce484222325n;
  for (let i = 0; i < identity.length; i += 1) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(identity.charCodeAt(i))) * 0x100000001b3n);
  }
  return `c4z-v1-${hash.toString(16).padStart(16, '0')}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseLayoutOverrides(input: unknown, workspace: C4Workspace): LayoutOverrides {
  const hash = workspaceHash(workspace);
  if (!isRecord(input)) throw new Error('配置差分は JSON オブジェクトにしてください。');

  let values = input;
  if (Object.hasOwn(input, 'workspaceHash') && typeof input.workspaceHash === 'string') {
    if (input.workspaceHash !== hash)
      throw new Error('配置差分の workspaceHash が入力モデルと一致しません。');
    if (!Object.hasOwn(input, 'offsets') || !isRecord(input.offsets))
      throw new Error('配置差分の offsets は JSON オブジェクトにしてください。');
    values = input.offsets;
  }

  const offsets: Offsets = Object.create(null);
  for (const [id, value] of Object.entries(values)) {
    if (!Object.hasOwn(workspace.elements, id))
      throw new Error(`配置差分の要素 ID ${JSON.stringify(id)} が入力モデルにありません。`);
    if (
      !isRecord(value) ||
      !Object.hasOwn(value, 'dx') ||
      !Object.hasOwn(value, 'dy') ||
      typeof value.dx !== 'number' ||
      typeof value.dy !== 'number' ||
      !Number.isFinite(value.dx) ||
      !Number.isFinite(value.dy)
    ) {
      throw new Error(
        `配置差分の要素 ID ${JSON.stringify(id)} の dx / dy に有限の数値が必要です。`,
      );
    }
    offsets[id] = { dx: value.dx, dy: value.dy };
  }
  return { workspaceHash: hash, offsets };
}
