import type { Camera, FlyTo } from '../core/camera/camera';
import {
  clampZoom,
  fitBounds,
  framePoint,
  panBy,
  startFlyTo,
  worldToScreen,
} from '../core/camera/camera';
import { center, contains } from '../core/layout/bounds';
import type { Offset, Point, PositionedGraph, Rect, Size } from '../core/layout/types';
import { ancestors, descendants } from '../core/model/graph';
import type { C4Level } from '../core/model/types';
import type { LodFocus, Location } from '../core/lod/lod';
import type { DisplayEdge } from '../core/lod/edgeRollup';
import type { Scene, Selection } from '../core/renderer/hitTest';

interface WheelZoom {
  target: number;
  at: Point;
}

export interface Hud extends Location {
  camera: Camera;
  viewport: Size;
}

export interface Runtime {
  camera: Camera;
  viewport: Size;
  graph: PositionedGraph | null;
  safeArea: Rect | null;
  measureSafeArea?: () => Rect;
  overviewZoom: number;
  atOverview: boolean;
  lodFocus?: LodFocus;
  scene: Scene;
  displayEdges: DisplayEdge[];
  hover: Selection | null;
  pointer: Point | null;
  flight: FlyTo | null;
  wheel: WheelZoom | null;
  velocity: Point;
  preview: { id: string; offset: Offset } | null;
  reducedMotion: boolean;
  dirty: boolean;
  canvas: HTMLCanvasElement | null;
  hud: Hud;
  publish(hud: Hud): void;
  subscribe(listener: () => void): () => void;
}

export function createRuntime(): Runtime {
  const viewport = { width: 1, height: 1 };
  const camera = { x: 0, y: 0, zoom: 1 };
  const listeners = new Set<() => void>();
  const runtime: Runtime = {
    camera,
    viewport,
    graph: null,
    safeArea: null,
    overviewZoom: 0,
    atOverview: false,
    scene: { nodes: [], edges: [] },
    displayEdges: [],
    hover: null,
    pointer: null,
    flight: null,
    wheel: null,
    velocity: { x: 0, y: 0 },
    preview: null,
    reducedMotion: false,
    dirty: true,
    canvas: null,
    hud: { camera, viewport, path: [], level: 1 },
    publish(hud) {
      runtime.hud = hud;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return runtime;
}

export function stopMotion(runtime: Runtime) {
  runtime.flight = null;
  runtime.wheel = null;
  runtime.velocity = { x: 0, y: 0 };
}

function fly(runtime: Runtime, target: Camera) {
  stopMotion(runtime);
  if (runtime.reducedMotion) runtime.camera = target;
  else runtime.flight = startFlyTo(runtime.camera, target, runtime.viewport, performance.now());
  runtime.dirty = true;
}

export function canvasArea(runtime: Runtime): Rect {
  return runtime.safeArea ?? { x: 0, y: 0, ...runtime.viewport };
}

function frameArea(runtime: Runtime) {
  return runtime.measureSafeArea?.() ?? canvasArea(runtime);
}

export function fitMap(runtime: Runtime, animate = true) {
  const graph = runtime.graph;
  if (!graph) return;
  const area = frameArea(runtime);
  const target = fitBounds(graph.bounds, runtime.viewport, 0.82, area);
  runtime.overviewZoom = target.zoom;
  runtime.atOverview = true;
  runtime.lodFocus = undefined;
  if (animate) fly(runtime, target);
  else {
    stopMotion(runtime);
    runtime.camera = target;
    runtime.dirty = true;
  }
}

export function focusNode(runtime: Runtime, id: string, dive = false) {
  const graph = runtime.graph;
  const node = graph?.nodes[id];
  if (!graph || !node) return;
  const area = frameArea(runtime);
  const target = fitBounds(
    node,
    runtime.viewport,
    0.65,
    area,
    !dive && !node.element.childrenIds.length ? 185 / Math.min(node.width, node.height) : undefined,
  );
  const expanded = new Set(ancestors(graph.workspace, id));
  if (dive && node.element.childrenIds.length) expanded.add(id);
  runtime.lodFocus = { zoom: target.zoom, expanded, collapsed: new Set() };
  runtime.atOverview = false;
  fly(runtime, target);
}

export function revealNode(runtime: Runtime, id: string) {
  const node = runtime.graph?.nodes[id];
  if (!node) return;
  const area = frameArea(runtime);
  const point = center(node);
  const { camera, viewport } = runtime;
  const centered = contains(area, worldToScreen(point, camera, viewport));
  const topLeft = worldToScreen(node, camera, viewport);
  const width = node.width * camera.zoom;
  const height = node.height * camera.zoom;
  const canFit = width <= area.width && height <= area.height;
  if (
    !centered ||
    (canFit &&
      (!contains(area, topLeft) ||
        !contains(area, { x: topLeft.x + width, y: topLeft.y + height })))
  ) {
    runtime.atOverview = false;
    fly(runtime, framePoint(point, camera.zoom, viewport, area));
  }
}

export function levelParent(
  graph: PositionedGraph,
  level: 2 | 3,
  activePath: string[],
  selectedId?: string,
) {
  const { workspace, nodes } = graph;
  const kind = level === 2 ? 'softwareSystem' : 'container';
  const canExpand = (id: string) => {
    const node = nodes[id];
    return (
      node?.element.kind === kind &&
      node.element.childrenIds.length > 0 &&
      descendants(workspace, id).some(
        (child) => nodes[child]?.element.level === level && nodes[child]?.element.kind !== 'group',
      )
    );
  };
  const selectionPath = selectedId ? [selectedId, ...ancestors(workspace, selectedId)] : [];
  const nearbyPath = activePath.slice().reverse();
  const system = (path: string[]) =>
    path.find((id) => nodes[id]?.element.kind === 'softwareSystem');
  const scope = system(selectionPath) ?? system(nearbyPath);
  const local =
    selectionPath.find(canExpand) ??
    (scope &&
      (canExpand(scope)
        ? scope
        : (descendants(workspace, scope).find((id) => nearbyPath.includes(id) && canExpand(id)) ??
          descendants(workspace, scope).find(canExpand)))) ??
    nearbyPath.find(canExpand);
  if (local) return nodes[local];
  const candidates = Object.keys(nodes)
    .filter(canExpand)
    .map((id) => nodes[id]!);
  return level === 3
    ? candidates[0]
    : candidates.reduce<(typeof candidates)[number] | undefined>(
        (best, item) =>
          !best || item.width * item.height > best.width * best.height ? item : best,
        undefined,
      );
}

export function focusLevel(runtime: Runtime, level: C4Level, selectedId?: string) {
  if (level === 1) {
    fitMap(runtime);
    return;
  }
  const graph = runtime.graph;
  if (!graph) return;
  const parent = levelParent(graph, level, runtime.hud.path, selectedId);
  if (!parent) return;
  const id = parent.element.id;
  const target = fitBounds(parent, runtime.viewport, 0.88, frameArea(runtime));
  runtime.atOverview = false;
  runtime.lodFocus = {
    zoom: target.zoom,
    expanded: new Set([id, ...ancestors(graph.workspace, id)]),
    collapsed: new Set(
      descendants(graph.workspace, id).filter(
        (child) => graph.nodes[child]?.element.level === level,
      ),
    ),
  };
  fly(runtime, target);
}

export function focusCanvas(runtime: Runtime, keyboard = false) {
  runtime.canvas?.toggleAttribute('data-keyboard-focus', keyboard);
  runtime.canvas?.focus({ preventScroll: true });
}

export function aimZoom(runtime: Runtime, factor: number, at = center(canvasArea(runtime))) {
  runtime.atOverview = false;
  runtime.flight = null;
  runtime.velocity = { x: 0, y: 0 };
  runtime.wheel = {
    target: clampZoom((runtime.wheel?.target ?? runtime.camera.zoom) * factor),
    at,
  };
  runtime.dirty = true;
}

export function panMap(runtime: Runtime, delta: Point) {
  runtime.atOverview = false;
  stopMotion(runtime);
  runtime.camera = panBy(runtime.camera, delta);
  runtime.dirty = true;
}

export function moveMap(runtime: Runtime, point: Point) {
  runtime.atOverview = false;
  stopMotion(runtime);
  runtime.camera = { ...point, zoom: runtime.camera.zoom };
  runtime.dirty = true;
}
