import { advanceInertia, flyCamera, zoomAt, type Camera } from '@c4-zoom/core/camera/camera';
import { applyOffsets } from '@c4-zoom/core/layout/offsets';
import type { Offsets, PositionedGraph, Size } from '@c4-zoom/core/layout/types';
import { createEdgeRollup } from '@c4-zoom/core/lod/edgeRollup';
import { activeLocation, evaluateLod, type Visibility } from '@c4-zoom/core/lod/lod';
import { ancestors } from '@c4-zoom/core/model/graph';
import { renderCanvas, type Highlight } from '@c4-zoom/core/renderer/canvasRenderer';
import { buildScene, hitTest, type Selection } from '@c4-zoom/core/renderer/hitTest';
import { themes, type ThemeName } from '@c4-zoom/core/renderer/theme';
import type { AppSelection } from '../state/AppStateContext';
import { canvasArea, fitMap, type Runtime } from '../state/runtime';

export interface RenderInputs {
  base: PositionedGraph | null;
  graph: PositionedGraph | null;
  offsets: Offsets;
  theme: ThemeName;
  selection: AppSelection | null;
  highlight?: Highlight;
}

export function attachMapLoop(
  element: HTMLCanvasElement,
  runtime: Runtime,
  readInputs: () => RenderInputs,
  isDragging: () => boolean,
) {
  const ctx = element.getContext('2d');
  if (!ctx) return () => {};
  runtime.canvas = element;

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  function updateMotion() {
    runtime.reducedMotion = motion.matches;
    runtime.dirty = true;
  }
  updateMotion();
  motion.addEventListener('change', updateMotion);

  let ratio = 1;
  let frame = 0;
  let previousFrame = 0;
  let lastHud = -Infinity;
  let publishedCamera: Camera | null = null;
  let publishedGraph: PositionedGraph | null = null;
  let publishedSize: Size | null = null;
  let sceneCamera: Camera | null = null;
  let sceneGraph: PositionedGraph | null = null;
  let sceneSize: Size | null = null;
  let lodScale = 0;
  let lodBaseline = 0;
  let lodFocus: Runtime['lodFocus'];
  let publishedArea: Runtime['safeArea'] = null;
  let publishedJump: Runtime['levelJump'];
  let visibility: Visibility = new Map();
  let rollupWorkspace: PositionedGraph['workspace'] | null = null;
  let rollup: ReturnType<typeof createEdgeRollup> | undefined;
  let preview: Runtime['preview'] = null;
  let previewGraph: PositionedGraph | null = null;
  let previewOffsets: Offsets | null = null;

  function resize() {
    const { width, height } = element.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    const resized = width !== runtime.viewport.width || height !== runtime.viewport.height;
    runtime.viewport = { width, height };
    ratio = devicePixelRatio || 1;
    element.width = Math.round(width * ratio);
    element.height = Math.round(height * ratio);
    ctx!.setTransform(ratio, 0, 0, ratio, 0, 0);
    runtime.measureSafeArea?.();
    if (resized && runtime.atOverview) fitMap(runtime, false);
    runtime.dirty = true;
  }

  function tick(at: number) {
    frame = requestAnimationFrame(tick);
    if (ratio !== devicePixelRatio) resize();
    const dt = Math.min(50, at - (previousFrame || at));
    previousFrame = at;
    if (runtime.flight) {
      const flight = runtime.flight;
      runtime.camera = runtime.reducedMotion ? flight.to : flyCamera(flight, at);
      if (runtime.camera === flight.to) runtime.flight = null;
    } else if (runtime.wheel) {
      const { target, at: anchor } = runtime.wheel;
      const near = Math.abs(Math.log(target / runtime.camera.zoom)) < 0.003;
      const zoom =
        near || runtime.reducedMotion
          ? target
          : runtime.camera.zoom *
            Math.exp(Math.log(target / runtime.camera.zoom) * (1 - Math.exp(-dt / 68)));
      runtime.camera = zoomAt(runtime.camera, zoom, anchor, runtime.viewport);
      if (zoom === target) runtime.wheel = null;
    } else if (
      !isDragging() &&
      Math.hypot(runtime.velocity.x, runtime.velocity.y) > 0.025 &&
      !runtime.reducedMotion
    ) {
      const result = advanceInertia(runtime.camera, runtime.velocity, dt);
      runtime.camera = result.camera;
      runtime.velocity = result.velocity;
    }

    const { base, graph: committed, offsets, theme, selection, highlight } = readInputs();
    if (preview !== runtime.preview || previewOffsets !== offsets) {
      preview = runtime.preview;
      previewOffsets = offsets;
      previewGraph =
        base && preview ? applyOffsets(base, { ...offsets, [preview.id]: preview.offset }) : null;
    }
    const graph = previewGraph ?? committed;
    runtime.graph = graph;
    const sceneChanged =
      sceneGraph !== graph ||
      sceneCamera !== runtime.camera ||
      sceneSize !== runtime.viewport ||
      lodFocus !== runtime.lodFocus ||
      lodBaseline !== runtime.overviewZoom;
    const area = canvasArea(runtime);
    if (sceneChanged) {
      if (graph) {
        if (rollupWorkspace !== graph.workspace) {
          rollupWorkspace = graph.workspace;
          rollup = createEdgeRollup(graph.workspace);
        }
        if (
          sceneGraph !== graph ||
          lodScale !== runtime.camera.zoom ||
          lodFocus !== runtime.lodFocus ||
          lodBaseline !== runtime.overviewZoom
        ) {
          lodScale = runtime.camera.zoom;
          lodFocus = runtime.lodFocus;
          lodBaseline = runtime.overviewZoom;
          visibility = evaluateLod(graph, lodScale, lodBaseline, lodFocus);
        }
        runtime.displayEdges = rollup!(visibility);
        runtime.scene = buildScene(
          graph,
          visibility,
          runtime.displayEdges,
          runtime.camera,
          runtime.viewport,
        );
      } else {
        runtime.displayEdges = [];
        runtime.scene = { nodes: [], edges: [] };
      }
      sceneGraph = graph;
      sceneCamera = runtime.camera;
      sceneSize = runtime.viewport;
    }

    const repaint = sceneChanged || runtime.dirty || (highlight && !runtime.reducedMotion);
    if (repaint) {
      runtime.dirty = false;
      runtime.hover =
        runtime.pointer && !isDragging() ? hitTest(runtime.scene, runtime.pointer) : null;
      const visualSelection: Selection | null =
        selection?.kind === 'edge' ? { kind: 'edge', id: selection.edge.id } : selection;
      renderCanvas(ctx!, runtime.scene, runtime.camera, runtime.viewport, themes[theme], {
        area,
        selected: visualSelection,
        hovered: runtime.hover,
        highlight,
        time: at,
        reducedMotion: runtime.reducedMotion,
      });
    }
    const levelJump = runtime.flight ? undefined : runtime.levelJump;
    const needsHud =
      publishedJump !== levelJump ||
      publishedGraph !== graph ||
      publishedCamera !== runtime.camera ||
      publishedSize !== runtime.viewport ||
      publishedArea !== runtime.safeArea;
    if (needsHud && (at - lastHud >= 100 || publishedGraph?.workspace !== graph?.workspace)) {
      // ジャンプ着地時は目的地を現在地にする。連続操作中は画面から推定する。
      const id = levelJump?.targetId;
      const path = graph && id ? [...ancestors(graph.workspace, id).reverse(), id] : [];
      const location = levelJump
        ? { level: levelJump.level, path }
        : graph
          ? activeLocation(graph, visibility, runtime.camera, runtime.viewport, area)
          : { level: 1 as const, path: [] };
      runtime.publish({ ...location, camera: runtime.camera, viewport: runtime.viewport });
      publishedJump = levelJump;
      publishedGraph = graph;
      publishedCamera = runtime.camera;
      publishedSize = runtime.viewport;
      publishedArea = runtime.safeArea;
      lastHud = at;
    }
  }

  const observer = new ResizeObserver(resize);
  observer.observe(element);
  resize();
  frame = requestAnimationFrame(tick);
  return () => {
    observer.disconnect();
    cancelAnimationFrame(frame);
    motion.removeEventListener('change', updateMotion);
    runtime.canvas = null;
  };
}
