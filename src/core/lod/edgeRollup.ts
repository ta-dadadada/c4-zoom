import { ancestors } from '../model/graph';
import type { C4Relationship, C4Workspace } from '../model/types';
import type { Visibility } from './lod';

export interface DisplayEdge {
  id: string;
  sourceId: string;
  targetId: string;
  count: number;
  underlyingIds: string[];
  technologies: string[];
  summaryLabel: string;
  description?: string;
  bidirectional: boolean;
}

interface EdgeBucket {
  sourceId: string;
  targetId: string;
  edges: C4Relationship[];
}

const pairId = (sourceId: string, targetId: string) => JSON.stringify([sourceId, targetId]);

export function rollupEdges(workspace: C4Workspace, visibility: Visibility): DisplayEdge[] {
  const projected = workspace.relationships.flatMap((edge) => {
    const sourceId = visibility.get(edge.sourceId)?.anchorId;
    const targetId = visibility.get(edge.targetId)?.anchorId;
    return sourceId && targetId && sourceId !== targetId ? [{ edge, sourceId, targetId }] : [];
  });
  const directPairs = new Set(
    projected
      .filter(
        ({ edge, sourceId, targetId }) => edge.sourceId === sourceId && edge.targetId === targetId,
      )
      .map(({ sourceId, targetId }) => pairId(sourceId, targetId)),
  );
  const hierarchy = new Map<string, string[]>();
  function lineage(id: string) {
    let path = hierarchy.get(id);
    if (!path) {
      path = [id, ...ancestors(workspace, id)];
      hierarchy.set(id, path);
    }
    return path;
  }
  const refined = new Set<string>();
  for (const { sourceId, targetId } of projected) {
    for (const source of lineage(sourceId)) {
      for (const target of lineage(targetId)) {
        if (source === sourceId && target === targetId) continue;
        const key = pairId(source, target);
        if (directPairs.has(key)) refined.add(key);
      }
    }
  }

  const buckets = new Map<string, EdgeBucket>();
  for (const { edge, sourceId, targetId } of projected) {
    if (
      edge.sourceId === sourceId &&
      edge.targetId === targetId &&
      refined.has(pairId(sourceId, targetId))
    )
      continue;
    const id = pairId(sourceId, targetId);
    const bucket = buckets.get(id);
    if (bucket) bucket.edges.push(edge);
    else buckets.set(id, { sourceId, targetId, edges: [edge] });
  }
  return Array.from(buckets, ([id, { sourceId, targetId, edges }]) => {
    const direct = edges.find(
      (edge) => edge.sourceId === sourceId && edge.targetId === targetId && edge.description,
    );
    const description = direct?.description ?? edges.find((edge) => edge.description)?.description;
    return {
      id,
      sourceId,
      targetId,
      count: edges.length,
      underlyingIds: edges.map(({ id }) => id),
      technologies: [
        ...new Set(edges.flatMap((edge) => (edge.technology ? [edge.technology] : []))),
      ],
      description,
      summaryLabel: description ?? `${edges.length} connections`,
      bidirectional: buckets.has(pairId(targetId, sourceId)),
    };
  });
}

export function createEdgeRollup(workspace: C4Workspace) {
  let previousVisibility: Visibility | undefined;
  let previousAnchors: string | undefined;
  let edges: DisplayEdge[] = [];
  const endpoints = [
    ...new Set(workspace.relationships.flatMap((edge) => [edge.sourceId, edge.targetId])),
  ];
  return (visibility: Visibility) => {
    if (visibility === previousVisibility) return edges;
    previousVisibility = visibility;
    const anchors = JSON.stringify(endpoints.map((id) => visibility.get(id)?.anchorId));
    if (anchors !== previousAnchors) {
      previousAnchors = anchors;
      edges = rollupEdges(workspace, visibility);
    }
    return edges;
  };
}
