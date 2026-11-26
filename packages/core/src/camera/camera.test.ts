import { expect, it } from 'vitest';
import {
  advanceInertia,
  fitBounds,
  flyCamera,
  maxZoom,
  screenToWorld,
  startFlyTo,
  worldToScreen,
  zoomAt,
} from './camera.js';

const viewport = { width: 1200, height: 900 };
const camera = { x: -22, y: 42, zoom: 0.37 };

it('roundtrips world and screen coordinates and preserves the cursor anchor at the zoom limit', () => {
  const world = { x: 31, y: -55 };
  const screen = worldToScreen(world, camera, viewport);
  const roundtrip = screenToWorld(screen, camera, viewport);
  expect(roundtrip.x).toBeCloseTo(world.x);
  expect(roundtrip.y).toBeCloseTo(world.y);
  const zoomed = zoomAt(camera, 100, screen, viewport);
  expect(zoomed.zoom).toBe(maxZoom);
  const anchored = worldToScreen(world, zoomed, viewport);
  expect(anchored.x).toBeCloseTo(screen.x);
  expect(anchored.y).toBeCloseTo(screen.y);
});

it('fits and flies to the exact target via a distant zoom-out arc', () => {
  const from = { x: 0, y: 0, zoom: 2 };
  const to = fitBounds({ x: 2900, y: 50, width: 600, height: 300 }, viewport);
  const fly = startFlyTo(from, to, viewport, 10);
  expect(flyCamera(fly, fly.start)).toEqual(from);
  expect(flyCamera(fly, fly.start + fly.duration)).toEqual(to);
  expect(flyCamera(fly, fly.start + fly.duration / 2).zoom).toBeLessThan(to.zoom);
  expect(to.x).toBe(3200);
});

it('decays inertia consistently regardless of frame subdivision', () => {
  const velocity = { x: 0.8, y: -0.4 };
  const first = advanceInertia(camera, velocity, 16);
  const second = advanceInertia(first.camera, first.velocity, 16);
  const single = advanceInertia(camera, velocity, 32);
  expect(second.camera.x).toBeCloseTo(single.camera.x);
  expect(second.camera.y).toBeCloseTo(single.camera.y);
  expect(second.velocity.x).toBeCloseTo(single.velocity.x);
});
