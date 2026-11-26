import type { Point, Rect } from './types.js';

export function center(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

export function union(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

export function contains(rect: Rect, point: Point): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function graphBounds(roots: string[], nodes: Record<string, Rect>): Rect {
  let bounds: Rect | undefined;
  for (const id of roots) {
    const rect = nodes[id];
    if (rect)
      bounds = bounds
        ? union(bounds, rect)
        : { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }
  return bounds ?? { x: 0, y: 0, width: 1, height: 1 };
}
