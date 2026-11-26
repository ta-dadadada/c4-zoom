import type { C4Relationship, C4Workspace } from './types.js';

export function ancestors(workspace: C4Workspace, id: string): string[] {
  const path: string[] = [];
  for (
    let parent = workspace.elements[id]?.parentId;
    parent;
    parent = workspace.elements[parent]?.parentId
  ) {
    path.push(parent);
  }
  return path;
}

export function descendants(workspace: C4Workspace, id: string): string[] {
  const result: string[] = [];
  const pending = [...(workspace.elements[id]?.childrenIds ?? [])].reverse();
  while (pending.length) {
    const next = pending.pop()!;
    result.push(next);
    const children = workspace.elements[next]?.childrenIds ?? [];
    for (let i = children.length - 1; i >= 0; i--) pending.push(children[i]!);
  }
  return result;
}

export type TraceMode = 'direct' | 'transitive';

export interface TraceLeg {
  nodeIds: string[];
  relationships: C4Relationship[];
}

export interface Trace {
  upstream: TraceLeg;
  downstream: TraceLeg;
  internal: C4Relationship[];
  cyclic: C4Relationship[];
}

export function traceDependencies(workspace: C4Workspace, id: string, mode: TraceMode): Trace {
  const origins = new Set([id, ...descendants(workspace, id)]);

  function traverse(direction: 'upstream' | 'downstream'): TraceLeg {
    const index = new Map<string, C4Relationship[]>();
    const [from, to] =
      direction === 'upstream'
        ? (['targetId', 'sourceId'] as const)
        : (['sourceId', 'targetId'] as const);
    for (const edge of workspace.relationships) {
      const bucket = index.get(edge[from]);
      if (bucket) bucket.push(edge);
      else index.set(edge[from], [edge]);
    }

    const pending = [...origins];
    const visited = new Set(origins);
    const nodeIds: string[] = [];
    const relationships: C4Relationship[] = [];
    for (let i = 0; i < pending.length; i++) {
      for (const edge of index.get(pending[i]!) ?? []) {
        const neighbor = edge[to];
        if (!(origins.has(neighbor) && origins.has(edge[from]))) relationships.push(edge);
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        nodeIds.push(neighbor);
        if (mode === 'transitive') pending.push(neighbor);
      }
    }
    return { nodeIds, relationships };
  }

  const upstream = traverse('upstream');
  const downstream = traverse('downstream');
  const upstreamIds = new Set(upstream.relationships.map((edge) => edge.id));
  return {
    upstream,
    downstream,
    internal: workspace.relationships.filter(
      (edge) => origins.has(edge.sourceId) && origins.has(edge.targetId),
    ),
    cyclic: downstream.relationships.filter((edge) => upstreamIds.has(edge.id)),
  };
}
