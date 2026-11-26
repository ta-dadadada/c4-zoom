import { minimapViewportRect } from './canvasRenderer.js';
import { expect, it } from 'vitest';
import {
  borderPoint,
  connectionCurve,
  curveIntersectsRect,
  curveDistance,
  pointOnCurve,
} from './geometry.js';
import { hitTest, type Scene } from './hitTest.js';
import type { PositionedElement } from '../layout/types.js';

it('anchors against the rounded corner and separates both directions', () => {
  const rect = { x: 0, y: 0, width: 80, height: 80 };
  const corner = borderPoint(rect, { x: 300, y: 300 }, 12);
  expect(corner.x).toBeCloseTo(68 + 12 / Math.sqrt(2));
  expect(corner.y).toBeCloseTo(corner.x);
  const other = { ...rect, x: 260 };
  const forward = connectionCurve(rect, other, true);
  const reverse = connectionCurve(other, rect, true);
  expect(pointOnCurve(forward, 0.5).y).toBeGreaterThan(40);
  expect(pointOnCurve(reverse, 0.5).y).toBeLessThan(40);
  expect(curveDistance(pointOnCurve(forward, 0.5), forward)).toBeLessThan(0.6);
});

function positioned(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
): PositionedElement {
  return {
    x,
    y,
    width,
    height,
    element: {
      id,
      kind: 'container',
      level: 2,
      name: id,
      tags: [],
      properties: {},
      parentId: null,
      childrenIds: [],
    },
  };
}

it('picks the deepest visible face and allows a curve hit over its containing frame', () => {
  const outer = positioned('outer', 0, 0, 400, 330);
  const inner = positioned('inner', 80, 85, 70, 60);
  const target = positioned('target', 210, 85, 60, 60);
  const curve = connectionCurve(inner, target, false);
  const scene: Scene = {
    nodes: [
      { node: outer, rect: outer, detail: 1, opacity: 1 },
      { node: inner, rect: inner, detail: 0, opacity: 1 },
      { node: target, rect: target, detail: 0, opacity: 0.2 },
    ],
    edges: [
      {
        edge: {
          id: 'edge',
          sourceId: 'inner',
          targetId: 'target',
          count: 1,
          underlyingIds: ['r1'],
          technologies: [],
          summaryLabel: '',
          bidirectional: false,
        },
        curve,
        bounds: { x: 150, y: 100, width: 60, height: 30 },
      },
    ],
  };
  expect(hitTest(scene, { x: 115, y: 111 })).toEqual({ kind: 'node', id: 'inner' });
  expect(hitTest(scene, { x: 182, y: 115 })).toEqual({ kind: 'edge', id: 'edge' });
  expect(hitTest(scene, { x: 229, y: 110 })).toEqual({ kind: 'node', id: 'outer' });
  expect(hitTest(scene, { x: 450, y: 400 })).toBeNull();
});

it('bends around a thin intermediate card and prefers the unblocked side', () => {
  const source = { x: 0, y: 0, width: 60, height: 50 };
  const target = { ...source, x: 440 };
  const across = { x: 160, y: 5, width: 80, height: 38 };
  const below = { x: 120, y: 53, width: 180, height: 120 };
  expect(curveIntersectsRect(connectionCurve(source, target, false), across)).toBe(true);
  const routed = connectionCurve(source, target, false, 12, [across, below]);
  expect(pointOnCurve(routed, 0.5).y).toBeLessThan(across.y);
  expect(curveIntersectsRect(routed, across)).toBe(false);
  expect(curveIntersectsRect(routed, below)).toBe(false);
});

it('keeps the minimap viewport fully inside the portrait inset', () => {
  const viewport = { width: 390, height: 844 };
  const size = { width: 106, height: 62 };
  const overview = { x: 50, y: 50, zoom: 0.2 };
  for (const y of [-5000, 0, 5000]) {
    const rect = minimapViewportRect({ x: 0, y, zoom: 0.05 }, viewport, overview, size);
    expect(rect.y).toBeGreaterThanOrEqual(1);
    expect(rect.y + rect.height).toBeLessThanOrEqual(size.height - 1);
    expect(rect.x + rect.width).toBeLessThanOrEqual(size.width - 1);
    expect(rect.height).toBeGreaterThan(0);
  }
});

it('moves a long connection past the corner of a wide card near its endpoint', () => {
  const source = { x: 1146, y: 615, width: 90, height: 42 };
  const target = { x: 203, y: 526, width: 58, height: 36 };
  const district = { x: 292, y: 407, width: 555, height: 232 };
  const curve = connectionCurve(source, target, false, 12, [district]);
  expect(curveIntersectsRect(curve, district)).toBe(false);
});
