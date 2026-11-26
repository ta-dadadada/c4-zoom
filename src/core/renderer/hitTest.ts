import { worldToScreen, type Camera } from '../camera/camera';
import { contains, intersects } from '../layout/bounds';
import type { Point, PositionedElement, PositionedGraph, Rect, Size } from '../layout/types';
import { ancestors } from '../model/graph';
import type { DisplayEdge } from '../lod/edgeRollup';
import { anchorThreshold, type Visibility } from '../lod/lod';
import { connectionCurve, curveBounds, curveDistance, type Curve } from './geometry';

export interface SceneNode {
  node: PositionedElement;
  rect: Rect;
  detail: number;
  opacity: number;
  anchorId?: string;
  labelBounds?: Rect;
}

export interface SceneEdge {
  edge: DisplayEdge;
  curve: Curve;
  bounds: Rect;
  labelBounds?: Rect;
}

export interface Scene {
  nodes: SceneNode[];
  edges: SceneEdge[];
}

export type Selection = { kind: 'node'; id: string } | { kind: 'edge'; id: string };

export function projectRect(rect: Rect, camera: Camera, viewport: Size): Rect {
  return {
    ...worldToScreen(rect, camera, viewport),
    width: rect.width * camera.zoom,
    height: rect.height * camera.zoom,
  };
}

export function nodeRadius(rect: Rect): number {
  return Math.min(12, rect.width / 2, rect.height / 2);
}

export function buildScene(
  graph: PositionedGraph,
  visibility: Visibility,
  edges: DisplayEdge[],
  camera: Camera,
  viewport: Size,
): Scene {
  const visibleRect: Rect = {
    x: -16,
    y: -16,
    width: viewport.width + 32,
    height: viewport.height + 32,
  };
  const nodes: SceneNode[] = [];
  const projected = new Map<string, Rect>();
  const sceneEdges: SceneEdge[] = [];

  function screenRect(id: string) {
    let rect = projected.get(id);
    if (!rect) {
      rect = projectRect(graph.nodes[id]!, camera, viewport);
      projected.set(id, rect);
    }
    return rect;
  }

  function visit(id: string) {
    const state = visibility.get(id)!;
    if (state.opacity < 0.01) return;
    const rect = screenRect(id);
    if (!intersects(visibleRect, rect)) return;
    const node = graph.nodes[id]!;
    nodes.push({ node, rect, ...state });
    node.element.childrenIds.forEach(visit);
  }

  graph.workspace.rootIds.forEach(visit);
  const faces = nodes.filter(
    ({ node, detail, anchorId }) =>
      node.element.kind !== 'group' && detail < anchorThreshold && node.element.id === anchorId,
  );
  const lineages = new Map<string, string[]>();
  function lineage(id: string) {
    let path = lineages.get(id);
    if (!path) {
      path = [id, ...ancestors(graph.workspace, id)];
      lineages.set(id, path);
    }
    return path;
  }
  for (const edge of edges) {
    const source = screenRect(edge.sourceId);
    const target = screenRect(edge.targetId);
    const straight = connectionCurve(source, target, edge.bidirectional);
    if (!intersects(visibleRect, curveBounds(straight, 12))) continue;
    const endpoints = new Set([...lineage(edge.sourceId), ...lineage(edge.targetId)]);
    const corridor = curveBounds(straight, 230);
    const obstacles = faces
      .filter(({ node, rect }) => !endpoints.has(node.element.id) && intersects(corridor, rect))
      .map(({ rect }) => ({
        x: rect.x - 3,
        y: rect.y - 3,
        width: rect.width + 6,
        height: rect.height + 6,
      }));
    const curve = obstacles.length
      ? connectionCurve(source, target, edge.bidirectional, 12, obstacles)
      : straight;
    const bounds = curveBounds(curve, 12);
    if (intersects(visibleRect, bounds)) sceneEdges.push({ edge, curve, bounds });
  }
  return { nodes, edges: sceneEdges };
}

export function hitTest(scene: Scene, point: Point): Selection | null {
  for (let i = scene.nodes.length - 1; i >= 0; i--) {
    const { node, labelBounds, opacity, anchorId } = scene.nodes[i]!;
    if (
      labelBounds &&
      opacity >= 0.16 &&
      (!anchorId || anchorId === node.element.id) &&
      contains(labelBounds, point)
    )
      return { kind: 'node', id: node.element.id };
  }
  for (const { edge, labelBounds } of scene.edges) {
    if (labelBounds && contains(labelBounds, point)) return { kind: 'edge', id: edge.id };
  }
  let frame: Selection | null = null;
  for (let i = scene.nodes.length - 1; i >= 0; i--) {
    const { node, rect, opacity, detail, anchorId } = scene.nodes[i]!;
    if (
      (anchorId ? anchorId !== node.element.id || opacity < 0.16 : opacity < anchorThreshold) ||
      !contains(rect, point)
    )
      continue;
    const radius = nodeRadius(rect);
    const dx = Math.max(rect.x + radius - point.x, point.x - (rect.x + rect.width - radius), 0);
    const dy = Math.max(rect.y + radius - point.y, point.y - (rect.y + rect.height - radius), 0);
    if (dx * dx + dy * dy > radius * radius) continue;
    const selection = { kind: 'node', id: node.element.id } as const;
    if (detail < anchorThreshold || point.y - rect.y <= 28) return selection;
    frame ??= selection;
  }

  let edgeHit: Selection | null = null;
  let bestDistance = 7;
  for (const { edge, curve, bounds } of scene.edges) {
    if (!contains(bounds, point)) continue;
    const distance = curveDistance(point, curve);
    if (distance < bestDistance) {
      bestDistance = distance;
      edgeHit = { kind: 'edge', id: edge.id };
    }
  }
  return edgeHit ?? frame;
}
