import { center } from '../layout/bounds.js';
import type { Point, PositionedGraph, Rect, Size } from '../layout/types.js';
import { detailEnd, detailStart, type LodFocus } from '../lod/lod.js';
import { ancestors, descendants } from '../model/graph.js';
import type { C4Level, ElementKind } from '../model/types.js';
import { fitBounds, screenToWorld, type Camera } from './camera.js';

interface SystemTarget {
  id: string;
  name: string;
  childCount: number;
}

interface ContainerTarget extends SystemTarget {
  systemId: string;
  systemName: string;
}

export interface LevelJumpTargets {
  l1: boolean;
  l2: SystemTarget[];
  l3: ContainerTarget[];
}

export interface LevelJumpPosition {
  level: C4Level;
  targetId?: string;
}

export interface LevelJumpTarget extends LevelJumpPosition {
  camera: Camera;
  lodFocus?: LodFocus;
}

interface JumpOptions {
  area?: Rect;
  selectedId?: string;
  targetId?: string;
}

function childIds(graph: PositionedGraph, id: string, kind: ElementKind) {
  return descendants(graph.workspace, id).filter(
    (childId) => graph.nodes[childId]?.element.kind === kind,
  );
}

export function listLevelJumpTargets(graph: PositionedGraph): LevelJumpTargets {
  const l2: SystemTarget[] = [];
  const l3: ContainerTarget[] = [];
  for (const system of Object.values(graph.workspace.elements)) {
    if (system.kind !== 'softwareSystem') continue;
    const containers = childIds(graph, system.id, 'container');
    if (containers.length === 0) continue;
    l2.push({ id: system.id, name: system.name, childCount: containers.length });
    for (const id of containers) {
      const components = childIds(graph, id, 'component');
      if (components.length === 0) continue;
      l3.push({
        id,
        name: graph.nodes[id]!.element.name,
        childCount: components.length,
        systemId: system.id,
        systemName: system.name,
      });
    }
  }
  return { l1: graph.workspace.rootIds.length > 0, l2, l3 };
}

function overviewTarget(graph: PositionedGraph, viewport: Size, area: Rect): LevelJumpTarget {
  let maxZoom = Infinity;
  for (const node of Object.values(graph.nodes)) {
    if (node.element.kind === 'softwareSystem' && node.element.childrenIds.length > 0) {
      maxZoom = Math.min(maxZoom, (detailStart - 1) / Math.min(node.width, node.height));
    }
  }
  return { level: 1, camera: fitBounds(graph.bounds, viewport, 0.82, area, maxZoom) };
}

function resolveTarget(
  graph: PositionedGraph,
  targets: SystemTarget[],
  origin: Point,
  selectedId?: string,
) {
  if (selectedId) {
    const path = [selectedId, ...ancestors(graph.workspace, selectedId)];
    for (const id of path) {
      const match = targets.find((target) => target.id === id);
      if (match) return match;
    }
  }
  let nearest: SystemTarget | undefined;
  let distance = Infinity;
  for (const target of targets) {
    const point = center(graph.nodes[target.id]!);
    const currentDistance = Math.hypot(point.x - origin.x, point.y - origin.y);
    if (currentDistance < distance) {
      nearest = target;
      distance = currentDistance;
    }
  }
  return nearest;
}

function frameLevel(
  graph: PositionedGraph,
  viewport: Size,
  area: Rect,
  level: 2 | 3,
  id: string,
): LevelJumpTarget {
  const node = graph.nodes[id]!;
  const preferred = fitBounds(node, viewport, 0.78, area).zoom;
  const children = childIds(graph, id, level === 2 ? 'container' : 'component');
  let childLimit = Infinity;
  for (const childId of children) {
    const child = graph.nodes[childId]!;
    if (child.element.childrenIds.length > 0) {
      childLimit = Math.min(childLimit, (detailStart - 1) / Math.min(child.width, child.height));
    }
  }
  const desired = Math.max(
    detailEnd / Math.min(node.width, node.height),
    Math.min(preferred, childLimit),
  );
  const camera = fitBounds(node, viewport, 1, area, desired);
  return {
    level,
    targetId: id,
    camera,
    lodFocus: {
      zoom: camera.zoom,
      // 小画面でもフレーム内に全体を収め、着地時は目的の階層を展開する。
      expanded: new Set([id, ...ancestors(graph.workspace, id)]),
      collapsed: new Set(children),
    },
  };
}

export function computeLevelJumpTarget(
  graph: PositionedGraph,
  camera: Camera,
  viewport: Size,
  level: C4Level,
  options: JumpOptions = {},
): LevelJumpTarget | undefined {
  const { area = { x: 0, y: 0, ...viewport }, selectedId, targetId } = options;
  if (level === 1) return overviewTarget(graph, viewport, area);
  const { l2, l3 } = listLevelJumpTargets(graph);
  const targets = level === 2 ? l2 : l3;
  const firstInSelectedSystem =
    level === 3 ? l3.find((item) => item.systemId === selectedId) : undefined;
  const target = targetId
    ? targets.find((item) => item.id === targetId)
    : (firstInSelectedSystem ??
      resolveTarget(graph, targets, screenToWorld(center(area), camera, viewport), selectedId));
  return target && frameLevel(graph, viewport, area, level, target.id);
}

export function computeSiblingJump(
  graph: PositionedGraph,
  camera: Camera,
  viewport: Size,
  current: LevelJumpPosition,
  direction: 'prev' | 'next',
  area: Rect = { x: 0, y: 0, ...viewport },
): LevelJumpTarget | undefined {
  const { level, targetId } = current;
  if (level === 1) return;
  const { l2, l3 } = listLevelJumpTargets(graph);
  const origin = screenToWorld(center(area), camera, viewport);
  const currentTarget = resolveTarget(graph, level === 2 ? l2 : l3, origin, targetId);
  if (!currentTarget) return;
  const currentContainer = l3.find(({ id }) => id === currentTarget.id);
  const siblings =
    level === 2 ? l2 : l3.filter(({ systemId }) => systemId === currentContainer?.systemId);
  if (siblings.length < 2) return;
  const index = siblings.findIndex(({ id }) => id === currentTarget.id);
  const step = direction === 'next' ? 1 : -1;
  const next = siblings[(index + step + siblings.length) % siblings.length]!;
  return frameLevel(graph, viewport, area, level, next.id);
}

export function computeZoomUpTarget(
  graph: PositionedGraph,
  camera: Camera,
  viewport: Size,
  current: LevelJumpPosition,
  area: Rect = { x: 0, y: 0, ...viewport },
): LevelJumpTarget | undefined {
  if (current.level === 1) return;
  if (current.level === 2) return overviewTarget(graph, viewport, area);
  return computeLevelJumpTarget(graph, camera, viewport, 2, {
    area,
    selectedId: current.targetId,
  });
}
