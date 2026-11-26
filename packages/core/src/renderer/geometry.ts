import { center, intersects } from '../layout/bounds.js';
import type { Point, Rect } from '../layout/types.js';

export interface Curve {
  start: Point;
  control: Point;
  end: Point;
}

export function borderPoint(rect: Rect, toward: Point, radius: number): Point {
  const origin = center(rect);
  const dx = toward.x - origin.x;
  const dy = toward.y - origin.y;
  if (dx === 0 && dy === 0) return { x: origin.x + rect.width / 2, y: origin.y };
  const halfWidth = rect.width / 2;
  const halfHeight = rect.height / 2;
  const along = Math.min(halfWidth / Math.abs(dx), halfHeight / Math.abs(dy));
  const x = dx * along;
  const y = dy * along;
  radius = Math.min(radius, halfWidth, halfHeight);
  const cornerX = halfWidth - radius;
  const cornerY = halfHeight - radius;
  if (Math.abs(x) <= cornerX || Math.abs(y) <= cornerY || !radius)
    return { x: origin.x + x, y: origin.y + y };
  const length = Math.hypot(dx, dy);
  const ux = Math.abs(dx / length);
  const uy = Math.abs(dy / length);
  const dot = ux * cornerX + uy * cornerY;
  const cross = ux * cornerY - uy * cornerX;
  const distance = dot + Math.sqrt(Math.max(0, radius * radius - cross * cross));
  return { x: origin.x + (dx / length) * distance, y: origin.y + (dy / length) * distance };
}

export function connectionCurve(
  source: Rect,
  target: Rect,
  bidirectional: boolean,
  radius = 12,
  obstacles: readonly Rect[] = [],
): Curve {
  const from = center(source);
  const to = center(target);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const bend = bidirectional ? Math.min(56, Math.max(16, length * 0.18)) : 0;
  function bendBy(offset: number, along = 0.5): Curve {
    const control = {
      x: from.x + dx * along - (dy * offset) / length,
      y: from.y + dy * along + (dx * offset) / length,
    };
    return {
      start: borderPoint(source, control, radius),
      control,
      end: borderPoint(target, control, radius),
    };
  }
  function collisions(curve: Curve) {
    return obstacles.reduce((total, rect) => total + Number(curveIntersectsRect(curve, rect)), 0);
  }
  let best = bendBy(bend);
  let score = collisions(best);
  if (!score) return best;

  const limit = Math.min(450, length * 0.72);
  // 双方向の線は同じ側に重ならないよう、元の曲がり方を優先する。
  for (const fraction of [0.3, 0.52, 0.75, 1]) {
    for (const side of [1, -1]) {
      const offset = side * limit * fraction;
      if (Math.abs(offset) <= bend) continue;
      for (const along of [0.5, 0.24, 0.76, 0.12, 0.88]) {
        const curve = bendBy(offset, along);
        const count = collisions(curve);
        if (!count) return curve;
        if (count < score) {
          best = curve;
          score = count;
        }
      }
    }
  }
  return best;
}

function segmentIntersectsRect(a: Point, b: Point, rect: Rect) {
  let entry = 0;
  let exit = 1;
  for (const [start, end, low, high] of [
    [a.x, b.x, rect.x, rect.x + rect.width],
    [a.y, b.y, rect.y, rect.y + rect.height],
  ] as const) {
    const delta = end - start;
    if (delta === 0) {
      if (start < low || start > high) return false;
      continue;
    }
    const u = (low - start) / delta;
    const v = (high - start) / delta;
    entry = Math.max(entry, Math.min(u, v));
    exit = Math.min(exit, Math.max(u, v));
    if (entry > exit) return false;
  }
  return true;
}

export function curveIntersectsRect(curve: Curve, rect: Rect): boolean {
  if (!intersects(curveBounds(curve, 1), rect)) return false;
  const steps = Math.min(
    20,
    Math.max(1, Math.ceil(Math.sqrt(segmentDistance(curve.control, curve.start, curve.end)))),
  );
  let previous = curve.start;
  for (let i = 1; i <= steps; i++) {
    const next = pointOnCurve(curve, i / steps);
    if (segmentIntersectsRect(previous, next, rect)) return true;
    previous = next;
  }
  return false;
}

export function pointOnCurve(curve: Curve, t: number): Point {
  const { start, control, end } = curve;
  const a = (1 - t) ** 2;
  const b = 2 * t * (1 - t);
  const c = t ** 2;
  return { x: a * start.x + b * control.x + c * end.x, y: a * start.y + b * control.y + c * end.y };
}

export function curveBounds({ start, control, end }: Curve, padding = 0): Rect {
  const x = Math.min(start.x, control.x, end.x);
  const y = Math.min(start.y, control.y, end.y);
  return {
    x: x - padding,
    y: y - padding,
    width: Math.max(start.x, control.x, end.x) - x + 2 * padding,
    height: Math.max(start.y, control.y, end.y) - y + 2 * padding,
  };
}

export function arrowhead({ control, start, end }: Curve, size: number): [Point, Point] {
  const from = control.x === end.x && control.y === end.y ? start : control;
  const angle = Math.atan2(end.y - from.y, end.x - from.x);
  return [angle - 0.48, angle + 0.48].map((a) => ({
    x: end.x - size * Math.cos(a),
    y: end.y - size * Math.sin(a),
  })) as [Point, Point];
}

function segmentDistance(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = dx * dx + dy * dy;
  const t = length
    ? Math.min(1, Math.max(0, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length))
    : 0;
  return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t));
}

export function curveDistance(point: Point, curve: Curve): number {
  const bend = segmentDistance(curve.control, curve.start, curve.end);
  const steps = Math.min(40, Math.max(1, Math.ceil(Math.sqrt(bend * 2))));
  let previous = curve.start;
  let distance = Infinity;
  for (let i = 1; i <= steps; i++) {
    const next = pointOnCurve(curve, i / steps);
    distance = Math.min(distance, segmentDistance(point, previous, next));
    previous = next;
  }
  return distance;
}
