import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { parseStructurizrWorkspaceJson } from '@c4-zoom/core/json';
import { layoutWorkspace } from '@c4-zoom/core/layout/elkLayout';
import { worldToScreen } from '@c4-zoom/core/camera/camera';
import { center, contains } from '@c4-zoom/core/layout/bounds';
import type { PositionedGraph } from '@c4-zoom/core/layout/types';
import { evaluateLod } from '@c4-zoom/core/lod/lod';
import {
  createRuntime,
  cycleLevel,
  fitMap,
  focusLevel,
  focusLevelTarget,
  focusNode,
  panMap,
  stopMotion,
  zoomUp,
} from './runtime';

let graph: PositionedGraph;
beforeAll(async () => {
  const file = new URL('../../../../fixtures/json/upstream/big-bank-plc.json', import.meta.url);
  graph = await layoutWorkspace(
    parseStructurizrWorkspaceJson(readFileSync(file, 'utf8')).workspace!,
  );
});

function runtimeWithGraph() {
  const runtime = createRuntime();
  runtime.graph = graph;
  runtime.viewport = { width: 1440, height: 900 };
  runtime.reducedMotion = true;
  return runtime;
}

it('frames sibling containers and components and opens their parent at the framed scale', () => {
  const runtime = runtimeWithGraph();
  fitMap(runtime);
  const system = graph.nodes['7']!;
  const container = graph.nodes['11']!;
  const descendants = (parent: typeof system) =>
    parent.element.childrenIds.map((id) => graph.nodes[id]!);
  for (const [level, parent] of [
    [2, system],
    [3, container],
  ] as const) {
    focusLevel(runtime, level, container.element.id);
    expect(runtime.camera.x).toBeCloseTo(center(parent).x);
    expect(runtime.camera.y).toBeCloseTo(center(parent).y);
    expect(runtime.camera.zoom).toBeLessThan(3.5);
    const visible = evaluateLod(graph, runtime.camera.zoom, runtime.overviewZoom, runtime.lodFocus);
    expect(visible.get(parent.element.id)?.detail).toBeGreaterThanOrEqual(0.85);
    expect(
      descendants(parent).every((node) => {
        const point = worldToScreen(
          { x: node.x + node.width, y: node.y + node.height },
          runtime.camera,
          runtime.viewport,
        );
        return (
          contains({ x: 0, y: 0, ...runtime.viewport }, point) &&
          visible.get(node.element.id)?.opacity === 1
        );
      }),
    ).toBe(true);
  }
});

it('centers Fit, search and level jumps in the unobstructed area', () => {
  const runtime = runtimeWithGraph();
  const target = graph.nodes['1']!;
  const system = graph.nodes['7']!;
  for (const area of [
    { x: 10, y: 75, width: 1070, height: 750 },
    { x: 10, y: 96, width: 370, height: 600 },
  ]) {
    if (area.width === 370) runtime.viewport = { width: 390, height: 844 };
    runtime.safeArea = area;
    for (const [navigate, bounds] of [
      [() => fitMap(runtime), graph.bounds],
      [() => focusNode(runtime, target.element.id), target],
      [() => focusLevel(runtime, 2, system.element.id), system],
    ] as const) {
      navigate();
      const point = worldToScreen(center(bounds), runtime.camera, runtime.viewport);
      expect(point.x).toBeCloseTo(center(area).x);
      expect(point.y).toBeCloseTo(center(area).y);
    }
  }
});

it('navigates up from the most recent jump before the HUD has updated', () => {
  const runtime = runtimeWithGraph();
  runtime.reducedMotion = false;
  expect(focusLevelTarget(runtime, 3, '11')).toBe(true);
  expect(runtime.flight?.to).toBeDefined();
  expect(runtime.hud.level).toBe(1);
  expect(runtime.levelJump).toEqual({ level: 3, targetId: '11' });
  cycleLevel(runtime, 'next');
  expect(runtime.levelJump).toEqual({ level: 3, targetId: '11' });
  zoomUp(runtime);
  expect(runtime.levelJump).toEqual({ level: 2, targetId: '7' });
  zoomUp(runtime);
  expect(runtime.levelJump?.level).toBe(1);
  expect(runtime.atOverview).toBe(true);
});

it('keeps the landed level during selection and returns to natural location on pan', () => {
  const runtime = runtimeWithGraph();
  focusLevelTarget(runtime, 3, '11');
  stopMotion(runtime);
  expect(runtime.levelJump).toEqual({ level: 3, targetId: '11' });
  panMap(runtime, { x: 10, y: 0 });
  expect(runtime.levelJump).toBeUndefined();
});
