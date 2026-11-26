import { drawNodeLabels, roundedRect, setFont, shorten } from './canvasLabels';
import { visibleBounds, type Camera } from '../camera/camera';
import { contains, intersects } from '../layout/bounds';
import type { PositionedGraph, Rect, Size } from '../layout/types';
import { arrowhead, pointOnCurve } from './geometry';
import {
  nodeRadius,
  projectRect,
  type Scene,
  type SceneEdge,
  type SceneNode,
  type Selection,
} from './hitTest';
import { elementRole, type Theme } from './theme';

function grid(ctx: CanvasRenderingContext2D, camera: Camera, viewport: Size, theme: Theme) {
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, viewport.width, viewport.height);
  const sizes = [1, 4];
  const unit = 2 ** Math.floor(Math.log2(44 / camera.zoom)) * camera.zoom;
  for (const scale of sizes) {
    const step = unit * scale;
    const left = (viewport.width / 2 - camera.x * camera.zoom) % step;
    const top = (viewport.height / 2 - camera.y * camera.zoom) % step;
    ctx.beginPath();
    for (let x = left; x < viewport.width; x += step) {
      const at = Math.floor(x) + 0.5;
      ctx.moveTo(at, 0);
      ctx.lineTo(at, viewport.height);
    }
    for (let y = top; y < viewport.height; y += step) {
      const at = Math.floor(y) + 0.5;
      ctx.moveTo(0, at);
      ctx.lineTo(viewport.width, at);
    }
    ctx.strokeStyle = scale === 1 ? theme.grid : theme.gridMajor;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

export interface Highlight {
  nodes: ReadonlySet<string>;
  upstream: ReadonlySet<string>;
  downstream: ReadonlySet<string>;
  internal: ReadonlySet<string>;
  cyclic: ReadonlySet<string>;
}

interface RenderState {
  area: Rect;
  selected: Selection | null;
  hovered: Selection | null;
  highlight?: Highlight;
  time: number;
  reducedMotion: boolean;
}

function match(selection: Selection | null, kind: Selection['kind'], id: string) {
  return selection?.kind === kind && selection.id === id;
}

function paintNode(
  ctx: CanvasRenderingContext2D,
  entry: SceneNode,
  theme: Theme,
  state: RenderState,
) {
  const { node, rect, opacity, detail } = entry;
  const { element } = node;
  const role = elementRole(element);
  const [fill, stroke, accent] = theme.roles[role];
  const selected = match(state.selected, 'node', element.id);
  const hovered = match(state.hovered, 'node', element.id);
  const dim = state.highlight && !state.highlight.nodes.has(element.id) ? 0.18 : 1;
  ctx.save();
  if (detail < 0.5 && rect.width > 70 && rect.height > 30 && dim === 1) {
    ctx.shadowColor = theme.shadow;
    ctx.shadowBlur = 12 * (1 - detail);
    ctx.shadowOffsetY = 3;
  }
  ctx.globalAlpha = opacity * dim * (role === 'group' ? 0.34 : 1 - 0.43 * detail);
  roundedRect(ctx, rect, nodeRadius(rect));
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.globalAlpha = opacity * dim;
  ctx.strokeStyle = selected || hovered ? theme.focus : stroke;
  ctx.lineWidth = selected ? 2.4 : hovered ? 1.8 : 1;
  if (role === 'group' || role === 'external') ctx.setLineDash(role === 'group' ? [3, 5] : [5, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
  if (element.kind === 'container' && detail < 0.75 && rect.height >= 26) {
    ctx.globalAlpha *= 1 - detail;
    roundedRect(ctx, { x: rect.x + 5, y: rect.y + 6, width: 3, height: rect.height - 12 }, 2);
    ctx.fillStyle = accent;
    ctx.fill();
  }
  ctx.restore();
}

function edgeImportance(entry: SceneEdge, state: RenderState) {
  if (match(state.selected, 'edge', entry.edge.id)) return 3;
  if (match(state.hovered, 'edge', entry.edge.id)) return 2;
  if (
    state.highlight &&
    entry.edge.underlyingIds.some(
      (id) =>
        state.highlight!.upstream.has(id) ||
        state.highlight!.downstream.has(id) ||
        state.highlight!.internal.has(id),
    )
  )
    return 1;
  return 0;
}

function paintEdge(
  ctx: CanvasRenderingContext2D,
  entry: SceneEdge,
  theme: Theme,
  state: RenderState,
  importance: number,
) {
  const { edge, curve } = entry;
  const { start, control, end } = curve;
  const upstream =
    state.highlight && edge.underlyingIds.some((id) => state.highlight!.upstream.has(id));
  const downstream =
    state.highlight && edge.underlyingIds.some((id) => state.highlight!.downstream.has(id));
  const cyclic =
    state.highlight && edge.underlyingIds.some((id) => state.highlight!.cyclic.has(id));
  const color = cyclic
    ? theme.cyclic
    : importance > 1
      ? theme.focus
      : downstream
        ? theme.downstream
        : upstream
          ? theme.upstream
          : theme.edge;
  const width = Math.min(4, 1.5 + Math.log2(edge.count) * 0.6) + (importance > 0 ? 0.55 : 0);
  ctx.save();
  ctx.globalAlpha = state.highlight && !importance ? 0.18 : 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  if (cyclic) ctx.setLineDash([6, 3]);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.quadraticCurveTo(control.x, control.y, end.x, end.y);
  ctx.stroke();
  if (cyclic) ctx.setLineDash([]);
  const [wingA, wingB] = arrowhead(curve, 6 + width);
  ctx.beginPath();
  ctx.moveTo(wingA.x, wingA.y);
  ctx.lineTo(end.x, end.y);
  ctx.lineTo(wingB.x, wingB.y);
  ctx.stroke();

  if ((upstream || downstream) && !state.reducedMotion) {
    ctx.fillStyle = color;
    const phase = (state.time / 1350) % 1;
    const point = pointOnCurve(curve, 0.04 + phase * 0.92);
    ctx.beginPath();
    ctx.arc(point.x, point.y, width + 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = theme.surface;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ctx.restore();
}

function edgeLabel(
  ctx: CanvasRenderingContext2D,
  entry: SceneEdge,
  theme: Theme,
  state: RenderState,
  importance: number,
  occupied: Rect[],
  faces: SceneNode[],
) {
  const { edge, curve } = entry;
  entry.labelBounds = undefined;
  if (state.highlight && !importance) return;
  const { technologies, description } = edge;
  const maxWidth = Math.min(state.area.width - 24, importance > 1 ? 220 : 156);
  setFont(ctx, 10, 650);
  const count = edge.count > 1 ? `${edge.count}件` : '';
  const join = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' · ');
  const protocols = technologies.join(', ');
  const remainder = technologies.length - 1;
  const compact = remainder > 0 ? `${technologies[0]} +${remainder}` : protocols;
  const metadata = join(
    ctx.measureText(join(protocols, count)).width <= maxWidth ? protocols : compact,
    count,
  );
  const span = Math.hypot(curve.end.x - curve.start.x, curve.end.y - curve.start.y);
  const full = join(description, metadata);
  const label =
    description &&
    (!protocols || importance > 1 || ctx.measureText(full).width + 15 < Math.min(span, maxWidth))
      ? full
      : metadata;
  if (!label) return;
  let text = shorten(ctx, label, maxWidth);
  const area = state.area;
  const canPlace = (rect: Rect) =>
    contains(area, rect) &&
    contains(area, { x: rect.x + rect.width, y: rect.y + rect.height }) &&
    !occupied.some((item) => intersects(item, rect));
  const pill = (at: { x: number; y: number }, width: number, offset = 0): Rect => ({
    x: at.x - width / 2,
    y: at.y - 9 + offset,
    width,
    height: 18,
  });
  const at = [0.5, 0.4, 0.6, 0.28, 0.72].map((t) => pointOnCurve(curve, t));
  const labelWidth = ctx.measureText(text).width + 14;
  let rect = at
    .map((point) => pill(point, labelWidth))
    .find(
      (candidate) => canPlace(candidate) && !faces.some((face) => intersects(face.rect, candidate)),
    );
  let leader: { x: number; y: number } | undefined;
  // カード間が狭くても集約の情報が読めるよう、線から少し離してラベルを置く。
  if (!rect && (technologies.length > 1 || importance > 1)) {
    text = shorten(
      ctx,
      protocols && technologies.length > 1 ? join(compact, count) : label,
      maxWidth,
    );
    const width = ctx.measureText(text).width + 14;
    for (const point of at.slice(0, 3)) {
      rect = [18, -18, 32, -32, 47, -47].map((offset) => pill(point, width, offset)).find(canPlace);
      if (rect) {
        leader = point;
        break;
      }
    }
  }
  if (!rect) return;
  occupied.push(rect);
  entry.labelBounds = rect;
  ctx.save();
  if (leader) {
    ctx.beginPath();
    ctx.moveTo(leader.x, leader.y);
    ctx.lineTo(leader.x, leader.y < rect.y ? rect.y : rect.y + rect.height);
    ctx.lineWidth = 1;
    ctx.strokeStyle = theme.edge;
    ctx.stroke();
  }
  roundedRect(ctx, rect, 7);
  ctx.fillStyle = theme.surface;
  ctx.fill();
  ctx.strokeStyle = importance > 1 ? theme.focus : theme.gridMajor;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = importance > 1 ? theme.focus : theme.muted;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, rect.x + 7, rect.y + 9);
  ctx.restore();
}

export function renderCanvas(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  camera: Camera,
  viewport: Size,
  theme: Theme,
  state: RenderState,
) {
  grid(ctx, camera, viewport, theme);
  const frames: SceneNode[] = [];
  const faces: SceneNode[] = [];
  for (const node of scene.nodes) {
    (node.detail > 0 || node.node.element.kind === 'group' ? frames : faces).push(node);
  }
  frames.forEach((node) => paintNode(ctx, node, theme, state));
  const edges = scene.edges.map((edge) => ({ edge, importance: edgeImportance(edge, state) }));
  edges.sort((a, b) => a.importance - b.importance);
  edges.forEach(({ edge, importance }) => paintEdge(ctx, edge, theme, state, importance));
  faces.forEach((node) => paintNode(ctx, node, theme, state));
  const labels = drawNodeLabels(ctx, scene.nodes, faces, theme, state.area, state.highlight?.nodes);
  edges.sort(
    (a, b) =>
      b.importance - a.importance ||
      b.edge.edge.technologies.length - a.edge.edge.technologies.length,
  );
  for (const { edge, importance } of edges)
    edgeLabel(ctx, edge, theme, state, importance, labels, faces);
}

export function minimapCamera(graph: PositionedGraph, size: Size): Camera {
  const { bounds } = graph;
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
    zoom: Math.min(
      Math.max(1, size.width - 16) / bounds.width,
      Math.max(1, size.height - 16) / bounds.height,
    ),
  };
}

export function minimapViewportRect(
  mapCamera: Camera,
  viewport: Size,
  overview: Camera,
  size: Size,
): Rect {
  const rect = projectRect(visibleBounds(mapCamera, viewport), overview, size);
  const left = Math.max(1, Math.min(size.width - 4, rect.x));
  const top = Math.max(1, Math.min(size.height - 4, rect.y));
  const right = Math.min(size.width - 1, Math.max(left + 3, rect.x + rect.width));
  const bottom = Math.min(size.height - 1, Math.max(top + 3, rect.y + rect.height));
  return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

export function renderMinimap(
  ctx: CanvasRenderingContext2D,
  graph: PositionedGraph,
  mapCamera: Camera,
  viewport: Size,
  size: Size,
  theme: Theme,
) {
  ctx.clearRect(0, 0, size.width, size.height);
  const overview = minimapCamera(graph, size);
  for (const node of Object.values(graph.nodes)) {
    if (node.element.level === 3) continue;
    const rect = projectRect(node, overview, size);
    ctx.fillStyle = theme.roles[elementRole(node.element)][1];
    ctx.globalAlpha =
      node.element.kind === 'group' || node.element.childrenIds.length ? 0.27 : 0.72;
    ctx.fillRect(rect.x, rect.y, Math.max(1.5, rect.width), Math.max(1.5, rect.height));
  }
  ctx.globalAlpha = 1;
  const rect = minimapViewportRect(mapCamera, viewport, overview, size);
  roundedRect(ctx, rect, 3);
  ctx.strokeStyle = theme.focus;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
