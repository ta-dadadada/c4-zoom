import { screenToWorld, type Camera } from '../camera/camera';
import { center, contains, intersects } from '../layout/bounds';
import type { PositionedGraph, Rect, Size } from '../layout/types';
import { ancestors } from '../model/graph';
import type { C4Level } from '../model/types';

export const detailStart = 140;
export const detailEnd = 260;
export const anchorThreshold = 0.5;

export function smoothstep(start: number, end: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

export function detailAlpha(width: number, height: number, zoom: number, overviewZoom = 0): number {
  const extent = Math.min(width, height);
  const start = Math.max(detailStart, extent * overviewZoom);
  return smoothstep(start, start + detailEnd - detailStart, extent * zoom);
}

export interface LodFocus {
  zoom: number;
  expanded: ReadonlySet<string>;
  collapsed: ReadonlySet<string>;
}

export interface ElementVisibility {
  detail: number;
  opacity: number;
  anchorId: string;
}

export type Visibility = Map<string, ElementVisibility>;

export function evaluateLod(
  graph: PositionedGraph,
  zoom: number,
  overviewZoom = 0,
  focus?: LodFocus,
): Visibility {
  const visibility: Visibility = new Map();

  function visit(id: string, opacity: number, ancestorAnchor?: string) {
    const node = graph.nodes[id]!;
    const group = node.element.kind === 'group';
    let detail = 0;
    // グループ枠は C4 の階層を増やさず、内包する要素と同じ時点で表示する。
    if (group) detail = 1;
    else if (node.element.childrenIds.length) {
      const baseline = focus?.collapsed.has(id) ? Math.max(overviewZoom, focus.zoom) : overviewZoom;
      detail = detailAlpha(node.width, node.height, zoom, baseline);
      // 親全体が収まる倍率を、選んだ範囲の展開基準にする。
      if (focus?.expanded.has(id))
        detail = Math.max(detail, smoothstep(focus.zoom * 0.55, focus.zoom * 0.96, zoom));
    }
    const anchorId = ancestorAnchor ?? id;
    visibility.set(id, { detail, opacity, anchorId });
    const childOpacity = group ? 1 : smoothstep(0.32, 1, detail);
    const collapsed = !group && detail < anchorThreshold;
    for (const child of node.element.childrenIds)
      visit(child, opacity * childOpacity, ancestorAnchor ?? (collapsed ? id : undefined));
  }

  graph.workspace.rootIds.forEach((id) => visit(id, 1));
  return visibility;
}

export interface Location {
  level: C4Level;
  path: string[];
}

export function activeLocation(
  graph: PositionedGraph,
  visibility: Visibility,
  camera: Camera,
  viewport: Size,
  area: Rect = { x: 0, y: 0, ...viewport },
): Location {
  const origin = screenToWorld(center(area), camera, viewport);
  const bounds = {
    ...screenToWorld(area, camera, viewport),
    width: area.width / camera.zoom,
    height: area.height / camera.zoom,
  };
  const scores = [0, 0, 0, 0];
  const representatives: ({ id: string; distance: number } | undefined)[] = [];
  let inside: string | undefined;
  for (const [id, node] of Object.entries(graph.nodes)) {
    const state = visibility.get(id);
    if (
      !state ||
      node.element.kind === 'group' ||
      state.anchorId !== id ||
      state.opacity < 0.16 ||
      !intersects(bounds, node)
    )
      continue;
    const level = node.element.level;
    const inView =
      (Math.min(bounds.x + bounds.width, node.x + node.width) - Math.max(bounds.x, node.x)) *
      (Math.min(bounds.y + bounds.height, node.y + node.height) - Math.max(bounds.y, node.y));
    scores[level] = scores[level]! + inView * state.opacity * (1 - 0.9 * state.detail);
    const point = center(node);
    const distance = Math.hypot(point.x - origin.x, point.y - origin.y);
    if (distance < (representatives[level]?.distance ?? Infinity))
      representatives[level] = { id, distance };
    if (contains(node, origin) && (!inside || level >= graph.nodes[inside]!.element.level))
      inside = id;
  }
  const level = ([1, 2, 3] as const).reduce(
    (best, item) => (scores[item]! > scores[best]! ? item : best),
    1,
  );
  const nearest = representatives[level];
  const local = inside && graph.nodes[inside]!.element.level >= level ? inside : undefined;
  const id =
    local ??
    (nearest && nearest.distance * camera.zoom <= Math.min(area.width, area.height) * 0.38
      ? nearest.id
      : inside);
  return { level, path: id ? [...ancestors(graph.workspace, id).reverse(), id] : [] };
}
