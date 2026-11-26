import type { Camera, FlyTo } from '@c4-zoom/core/camera/camera';
import {
  clampZoom,
  fitBounds,
  framePoint,
  panBy,
  startFlyTo,
  worldToScreen,
} from '@c4-zoom/core/camera/camera';
import {
  computeLevelJumpTarget,
  computeSiblingJump,
  computeZoomUpTarget,
  type LevelJumpPosition,
  type LevelJumpTarget,
} from '@c4-zoom/core/camera/levelJump';
import { center, contains } from '@c4-zoom/core/layout/bounds';
import type { Offset, Point, PositionedGraph, Rect, Size } from '@c4-zoom/core/layout/types';
import { ancestors } from '@c4-zoom/core/model/graph';
import type { C4Level } from '@c4-zoom/core/model/types';
import type { LodFocus, Location } from '@c4-zoom/core/lod/lod';
import type { DisplayEdge } from '@c4-zoom/core/lod/edgeRollup';
import type { Scene, Selection } from '@c4-zoom/core/renderer/hitTest';

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
  levelJump?: LevelJumpPosition;
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
  if (runtime.flight) runtime.levelJump = undefined;
  runtime.flight = null;
  runtime.wheel = null;
  runtime.velocity = { x: 0, y: 0 };
}

function fly(runtime: Runtime, target: Camera) {
  stopMotion(runtime);
  runtime.levelJump = undefined;
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

function applyLevelJump(runtime: Runtime, target: LevelJumpTarget, animate = true) {
  runtime.atOverview = target.level === 1;
  if (runtime.atOverview) runtime.overviewZoom = target.camera.zoom;
  runtime.lodFocus = target.lodFocus;
  if (animate) fly(runtime, target.camera);
  else {
    stopMotion(runtime);
    runtime.camera = target.camera;
    runtime.dirty = true;
  }
  runtime.levelJump = { level: target.level, targetId: target.targetId };
}

export function fitMap(runtime: Runtime, animate = true) {
  const { graph, camera, viewport } = runtime;
  if (!graph) return;
  const target = computeLevelJumpTarget(graph, camera, viewport, 1, { area: frameArea(runtime) });
  if (target) applyLevelJump(runtime, target, animate);
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

export function focusLevel(runtime: Runtime, level: C4Level, selectedId?: string) {
  const { graph, camera, viewport } = runtime;
  if (!graph) return;
  const target = computeLevelJumpTarget(graph, camera, viewport, level, {
    area: frameArea(runtime),
    selectedId,
  });
  if (target) applyLevelJump(runtime, target);
}

export function focusLevelTarget(runtime: Runtime, level: 2 | 3, targetId: string): boolean {
  const { graph, camera, viewport } = runtime;
  if (!graph) return false;
  const target = computeLevelJumpTarget(graph, camera, viewport, level, {
    area: frameArea(runtime),
    targetId,
  });
  if (!target) return false;
  applyLevelJump(runtime, target);
  return true;
}

function currentLevel(runtime: Runtime): LevelJumpPosition {
  return runtime.levelJump ?? { level: runtime.hud.level, targetId: runtime.hud.path.at(-1) };
}

export function cycleLevel(runtime: Runtime, direction: 'prev' | 'next') {
  const { graph, camera, viewport } = runtime;
  if (!graph) return;
  const target = computeSiblingJump(
    graph,
    camera,
    viewport,
    currentLevel(runtime),
    direction,
    frameArea(runtime),
  );
  if (target) applyLevelJump(runtime, target);
}

export function zoomUp(runtime: Runtime) {
  const { graph, camera, viewport } = runtime;
  if (!graph) return;
  const target = computeZoomUpTarget(
    graph,
    camera,
    viewport,
    currentLevel(runtime),
    frameArea(runtime),
  );
  if (target) applyLevelJump(runtime, target);
}

export function focusCanvas(runtime: Runtime, keyboard = false) {
  runtime.canvas?.toggleAttribute('data-keyboard-focus', keyboard);
  runtime.canvas?.focus({ preventScroll: true });
}

export function aimZoom(runtime: Runtime, factor: number, at = center(canvasArea(runtime))) {
  runtime.atOverview = false;
  runtime.levelJump = undefined;
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
  runtime.levelJump = undefined;
  stopMotion(runtime);
  runtime.camera = panBy(runtime.camera, delta);
  runtime.dirty = true;
}

export function moveMap(runtime: Runtime, point: Point) {
  runtime.atOverview = false;
  runtime.levelJump = undefined;
  stopMotion(runtime);
  runtime.camera = { ...point, zoom: runtime.camera.zoom };
  runtime.dirty = true;
}
