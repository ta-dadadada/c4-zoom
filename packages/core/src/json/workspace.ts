import type { C4Element, C4Level, C4Relationship, C4Workspace } from '../model/types.js';

export interface WorkspaceDiagnostic {
  severity: 'error' | 'warning' | 'info';
  message: string;
  path?: string;
  line?: number;
  column?: number;
}

export interface WorkspaceJsonResult {
  workspace?: C4Workspace;
  diagnostics: WorkspaceDiagnostic[];
}

type JsonObject = Record<string, unknown>;
type ModelKind = Exclude<C4Element['kind'], 'group'>;

export const maxWorkspaceJsonBytes = 32 * 1024 * 1024;
const maxElements = 50_000;
const maxRelationships = 250_000;
const maxGroupDepth = 32;
const maxGroupLength = 4096;
const forbiddenProperties = new Set(['__proto__', 'constructor', 'prototype']);

class WorkspaceLimitError extends Error {}

function asObject(value: unknown): JsonObject | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const prototype = Object.getPrototypeOf(value);
    if (prototype === null || prototype === Object.prototype) return value as JsonObject;
  }
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function properties(value: unknown): Record<string, string> {
  const result: Record<string, string> = Object.create(null);
  for (const [key, item] of Object.entries(asObject(value) ?? {})) {
    if (!forbiddenProperties.has(key) && typeof item === 'string') result[key] = item;
  }
  return result;
}

function details(value: JsonObject) {
  return {
    description: text(value.description),
    technology: text(value.technology),
    url: text(value.url),
    tags: [
      ...new Set(
        text(value.tags)
          ?.split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      ),
    ],
    properties: properties(value.properties),
  };
}

function syntaxDiagnostic(error: unknown, source: string): WorkspaceDiagnostic {
  const diagnostic: WorkspaceDiagnostic = {
    severity: 'error',
    message: 'JSON の構文が正しくありません。',
  };
  const offset =
    error instanceof SyntaxError &&
    /position (\d+)(?: \(line \d+ column \d+\))?$/.exec(error.message)?.[1];
  if (offset) {
    const prefix = source.slice(0, Number(offset));
    const lines = prefix.split(/\r\n|\r|\n/);
    diagnostic.line = lines.length;
    diagnostic.column = lines.at(-1)!.length + 1;
  }
  return diagnostic;
}

function normalize(
  root: JsonObject,
  model: JsonObject,
  diagnostics: WorkspaceDiagnostic[],
): C4Workspace {
  const elements: C4Workspace['elements'] = Object.create(null);
  const modelIds = new Set<string>();
  const rootIds: string[] = [];
  const relationships: C4Relationship[] = [];
  const pendingGroups: { element: C4Element; group?: string }[] = [];
  const pendingRelationships: { input: unknown; path: string }[] = [];
  const separator = text(asObject(model.properties)?.['structurizr.groupSeparator']) || '/';
  let elementCount = 0;
  let relationshipCount = 0;

  function addElements(
    input: unknown,
    path: string,
    kind: ModelKind,
    level: C4Level,
    parentId: string | null = null,
  ) {
    if (input === undefined) return;
    if (!Array.isArray(input)) {
      diagnostics.push({ severity: 'warning', message: '要素一覧が配列ではありません。', path });
      return;
    }
    elementCount += input.length;
    if (elementCount > maxElements) throw new WorkspaceLimitError('要素数が上限を超えています。');

    input.forEach((value: unknown, index) => {
      const item = asObject(value);
      const itemPath = `${path}[${index}]`;
      const id = text(item?.id);
      if (!item || !id?.trim()) {
        diagnostics.push({
          severity: 'warning',
          message: 'ID のない要素を除外しました。',
          path: itemPath,
        });
        return;
      }
      if (modelIds.has(id)) {
        diagnostics.push({
          severity: 'warning',
          message: '重複 ID の要素を除外しました。',
          path: itemPath,
        });
        return;
      }

      const originalName = text(item.name);
      const name = originalName?.trim() ? originalName : undefined;
      if (!name)
        diagnostics.push({
          severity: 'warning',
          message: '名前がないため ID を表示します。',
          path: itemPath,
        });
      const element: C4Element = {
        ...details(item),
        id,
        name: name || id,
        kind,
        level,
        parentId,
        childrenIds: [],
      };
      if (
        kind === 'softwareSystem' &&
        item.location === 'External' &&
        !element.tags.includes('External')
      )
        element.tags.push('External');
      modelIds.add(id);
      elements[id] = element;
      pendingGroups.push({ element, group: text(item.group) });
      if (Array.isArray(item.relationships)) {
        relationshipCount += item.relationships.length;
        if (relationshipCount > maxRelationships)
          throw new WorkspaceLimitError('関係線数が上限を超えています。');
        item.relationships.forEach((input: unknown, index) =>
          pendingRelationships.push({ input, path: `${itemPath}.relationships[${index}]` }),
        );
      } else if (item.relationships !== undefined) {
        diagnostics.push({
          severity: 'warning',
          message: '関係線一覧が配列ではありません。',
          path: `${itemPath}.relationships`,
        });
      }

      if (kind === 'softwareSystem')
        addElements(item.containers, `${itemPath}.containers`, 'container', 2, id);
      else if (kind === 'container')
        addElements(item.components, `${itemPath}.components`, 'component', 3, id);
    });
  }

  addElements(model.people, 'model.people', 'person', 1);
  addElements(model.softwareSystems, 'model.softwareSystems', 'softwareSystem', 1);
  addElements(model.customElements, 'model.customElements', 'element', 1);

  function append(id: string, parentId: string | null) {
    (parentId === null ? rootIds : elements[parentId]!.childrenIds).push(id);
  }

  // 公式 ID をすべて確保した後、親スコープごとに仮想グループを作る。
  const groupChildren = new Map<string | null, Map<string, C4Element>>();
  for (const { element, group = '' } of pendingGroups) {
    if (group.length > maxGroupLength) throw new WorkspaceLimitError('グループ名が長すぎます。');
    const names = group
      .split(separator)
      .map((name) => name.trim())
      .filter(Boolean);
    if (names.length > maxGroupDepth) throw new WorkspaceLimitError('グループ階層が深すぎます。');
    const parentId = element.parentId;
    let scope = parentId;
    names.forEach((name, index) => {
      let siblings = groupChildren.get(scope);
      if (!siblings) {
        siblings = new Map();
        groupChildren.set(scope, siblings);
      }
      let groupNode = siblings.get(name);
      if (!groupNode) {
        if (++elementCount > maxElements)
          throw new WorkspaceLimitError('要素数が上限を超えています。');
        const key = `group:${JSON.stringify([parentId, ...names.slice(0, index + 1)])}`;
        let id = key;
        for (let suffix = 1; Object.hasOwn(elements, id); suffix++) id = `${key}:${suffix}`;
        groupNode = {
          id,
          name,
          kind: 'group',
          level: element.level,
          parentId: scope,
          childrenIds: [],
          tags: [],
          properties: Object.create(null),
        };
        siblings.set(name, groupNode);
        elements[id] = groupNode;
        append(id, scope);
      }
      scope = groupNode.id;
    });
    element.parentId = scope;
    append(element.id, scope);
  }

  const relationshipIds = new Set<string>();
  for (const { input, path } of pendingRelationships) {
    const item = asObject(input);
    const id = text(item?.id);
    if (!item || !id?.trim()) {
      diagnostics.push({ severity: 'warning', message: 'ID のない関係線を除外しました。', path });
      continue;
    }
    if (relationshipIds.has(id)) continue;
    const sourceId = text(item.sourceId);
    const targetId = text(item.destinationId);
    if (!sourceId || !targetId) {
      diagnostics.push({
        severity: 'warning',
        message: '接続元または接続先のない関係線を除外しました。',
        path,
      });
      continue;
    }
    if (!modelIds.has(sourceId) || !modelIds.has(targetId)) {
      diagnostics.push({
        severity: 'info',
        message: '描画対象外の要素を参照する関係線を除外しました。',
        path,
      });
      continue;
    }
    relationshipIds.add(id);
    relationships.push({ ...details(item), id, sourceId, targetId });
  }

  const name = text(root.name);
  return {
    name: name?.trim() ? name : 'Untitled Workspace',
    description: text(root.description),
    elements,
    rootIds,
    relationships,
  };
}

export function parseStructurizrWorkspaceJson(input: unknown): WorkspaceJsonResult {
  let value = input;
  if (typeof input === 'string') {
    if (
      input.length > maxWorkspaceJsonBytes ||
      (input.length * 3 > maxWorkspaceJsonBytes &&
        new TextEncoder().encode(input).length > maxWorkspaceJsonBytes)
    )
      return {
        diagnostics: [{ severity: 'error', message: 'JSON ファイルが 32 MiB を超えています。' }],
      };
    const source = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
    try {
      value = JSON.parse(source);
    } catch (error) {
      return { diagnostics: [syntaxDiagnostic(error, source)] };
    }
  }

  const root = asObject(value);
  if (!root)
    return {
      diagnostics: [
        { severity: 'error', message: 'ワークスペースは JSON オブジェクトである必要があります。' },
      ],
    };
  const model = Object.hasOwn(root, 'model') && asObject(root.model);
  if (!model)
    return {
      diagnostics: [
        { severity: 'error', message: 'ワークスペースの model がありません。', path: 'model' },
      ],
    };

  const diagnostics: WorkspaceDiagnostic[] = [];
  try {
    return { workspace: normalize(root, model, diagnostics), diagnostics };
  } catch (error) {
    if (!(error instanceof WorkspaceLimitError)) throw error;
    return { diagnostics: [{ severity: 'error', message: error.message }] };
  }
}
