import { center } from '../layout/bounds.js';
import type { Point, Rect, Size } from '../layout/types.js';

export interface Camera extends Point {
  zoom: number;
}

export const minZoom = 0.04;
export const maxZoom = 12;
export const clampZoom = (zoom: number) => Math.min(maxZoom, Math.max(minZoom, zoom));

export function worldToScreen(point: Point, camera: Camera, viewport: Size): Point {
  return {
    x: (point.x - camera.x) * camera.zoom + viewport.width / 2,
    y: (point.y - camera.y) * camera.zoom + viewport.height / 2,
  };
}

export function screenToWorld(point: Point, camera: Camera, viewport: Size): Point {
  return {
    x: (point.x - viewport.width / 2) / camera.zoom + camera.x,
    y: (point.y - viewport.height / 2) / camera.zoom + camera.y,
  };
}

export function visibleBounds(camera: Camera, viewport: Size): Rect {
  return {
    ...screenToWorld({ x: 0, y: 0 }, camera, viewport),
    width: viewport.width / camera.zoom,
    height: viewport.height / camera.zoom,
  };
}

export function zoomAt(camera: Camera, zoom: number, anchor: Point, viewport: Size): Camera {
  const world = screenToWorld(anchor, camera, viewport);
  zoom = clampZoom(zoom);
  return {
    x: world.x - (anchor.x - viewport.width / 2) / zoom,
    y: world.y - (anchor.y - viewport.height / 2) / zoom,
    zoom,
  };
}

export function panBy(camera: Camera, delta: Point): Camera {
  return {
    x: camera.x - delta.x / camera.zoom,
    y: camera.y - delta.y / camera.zoom,
    zoom: camera.zoom,
  };
}

export function framePoint(point: Point, zoom: number, viewport: Size, area: Rect): Camera {
  zoom = clampZoom(zoom);
  const at = center(area);
  return {
    x: point.x + (viewport.width / 2 - at.x) / zoom,
    y: point.y + (viewport.height / 2 - at.y) / zoom,
    zoom,
  };
}

export function fitBounds(
  bounds: Rect,
  viewport: Size,
  fraction = 0.82,
  area: Rect = { x: 0, y: 0, ...viewport },
  maxFitZoom = maxZoom,
): Camera {
  const zoom = Math.min(
    area.width / Math.max(1, bounds.width),
    area.height / Math.max(1, bounds.height),
  );
  return framePoint(center(bounds), Math.min(zoom * fraction, maxFitZoom), viewport, area);
}

export function advanceInertia(
  camera: Camera,
  velocity: Point,
  dt: number,
): { camera: Camera; velocity: Point } {
  const decay = Math.exp(-dt / 115);
  const distance = (1 - decay) * 115;
  return {
    camera: panBy(camera, { x: velocity.x * distance, y: velocity.y * distance }),
    velocity: { x: velocity.x * decay, y: velocity.y * decay },
  };
}

export interface FlyTo {
  from: Camera;
  to: Camera;
  start: number;
  duration: number;
  lift: number;
}

export function startFlyTo(from: Camera, to: Camera, viewport: Size, now: number): FlyTo {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const screens =
    (distance * Math.min(from.zoom, to.zoom)) /
    Math.max(1, Math.min(viewport.width, viewport.height));
  return {
    from,
    to,
    start: now,
    duration: 550 + 300 * Math.min(1, screens / 2),
    lift: Math.log1p(Math.min(5, Math.max(0, screens - 0.3))),
  };
}

export function flyCamera(fly: FlyTo, now: number): Camera {
  const phase = (now - fly.start) / fly.duration;
  if (phase <= 0) return fly.from;
  if (phase >= 1) return fly.to;
  const t = phase < 0.5 ? 4 * phase ** 3 : 1 - (-2 * phase + 2) ** 3 / 2;
  const zoom = Math.exp(
    Math.log(fly.from.zoom) * (1 - t) + Math.log(fly.to.zoom) * t - fly.lift * 4 * t * (1 - t),
  );
  return {
    x: fly.from.x + (fly.to.x - fly.from.x) * t,
    y: fly.from.y + (fly.to.y - fly.from.y) * t,
    zoom: clampZoom(zoom),
  };
}
