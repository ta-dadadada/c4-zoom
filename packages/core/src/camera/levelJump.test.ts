import { expect, it } from 'vitest';
import { center } from '../layout/bounds.js';
import type { PositionedElement, PositionedGraph, Rect } from '../layout/types.js';
import { evaluateLod } from '../lod/lod.js';
import type { C4Element } from '../model/types.js';
import { worldToScreen } from './camera.js';
import {
  computeLevelJumpTarget,
  computeSiblingJump,
  computeZoomUpTarget,
  listLevelJumpTargets,
} from './levelJump.js';

function fixture(): PositionedGraph {
  const nodes: Record<string, PositionedElement> = Object.create(null);
  const elements: Record<string, C4Element> = Object.create(null);
  function add(
    id: string,
    kind: C4Element['kind'],
    level: C4Element['level'],
    parentId: string | null,
    rect: Rect,
  ) {
    const element: C4Element = {
      id,
      kind,
      level,
      name: id,
      parentId,
      childrenIds: [],
      tags: [],
      properties: {},
    };
    elements[id] = element;
    nodes[id] = { ...rect, element };
    if (parentId) elements[parentId]!.childrenIds.push(id);
  }
  add('A', 'softwareSystem', 1, null, { x: 0, y: 0, width: 600, height: 500 });
  add('group', 'group', 2, 'A', { x: 25, y: 25, width: 230, height: 375 });
  add('A-1', 'container', 2, 'group', { x: 50, y: 50, width: 180, height: 300 });
  add('A-1-1', 'component', 3, 'A-1', { x: 65, y: 110, width: 150, height: 90 });
  add('A-2', 'container', 2, 'A', { x: 300, y: 60, width: 250, height: 240 });
  add('A-2-1', 'component', 3, 'A-2', { x: 350, y: 140, width: 160, height: 95 });
  add('A-3', 'container', 2, 'A', { x: 315, y: 340, width: 200, height: 110 });
  add('B', 'softwareSystem', 1, null, { x: 700, y: 0, width: 520, height: 400 });
  add('B-1', 'container', 2, 'B', { x: 825, y: 70, width: 250, height: 230 });
  add('B-1-1', 'component', 3, 'B-1', { x: 890, y: 130, width: 160, height: 95 });
  add('C', 'softwareSystem', 1, null, { x: 1300, y: 10, width: 180, height: 120 });
  return {
    workspace: { name: 'Map', elements, rootIds: ['A', 'B', 'C'], relationships: [] },
    nodes,
    bounds: { x: 0, y: 0, width: 1480, height: 500 },
  };
}

const viewport = { width: 1440, height: 900 };
const nearB = { x: 950, y: 180, zoom: 1 };

it('fits the landscape below the collapsed threshold regardless of available viewport', () => {
  const graph = fixture();
  const target = computeLevelJumpTarget(graph, nearB, viewport, 1)!;
  expect(target.level).toBe(1);
  expect(target.camera.zoom * 500).toBeLessThan(140);
  expect(target.camera.zoom * graph.bounds.width).toBeLessThan(viewport.width);
  expect(evaluateLod(graph, target.camera.zoom).get('A')?.detail).toBe(0);
});

it('lists systems and component-bearing containers through transparent groups', () => {
  const targets = listLevelJumpTargets(fixture());
  expect(targets.l1).toBe(true);
  expect(targets.l2).toEqual([
    { id: 'A', name: 'A', childCount: 3 },
    { id: 'B', name: 'B', childCount: 1 },
  ]);
  expect(targets.l3.map(({ id, systemId, childCount }) => [id, systemId, childCount])).toEqual([
    ['A-1', 'A', 1],
    ['A-2', 'A', 1],
    ['B-1', 'B', 1],
  ]);
});

it('uses the selected ancestor or first container in a selected system before geometric proximity', () => {
  const graph = fixture();
  expect(computeLevelJumpTarget(graph, nearB, viewport, 2)?.targetId).toBe('B');
  expect(computeLevelJumpTarget(graph, nearB, viewport, 3)?.targetId).toBe('B-1');
  expect(computeLevelJumpTarget(graph, nearB, viewport, 2, { selectedId: 'A-1-1' })?.targetId).toBe(
    'A',
  );
  expect(computeLevelJumpTarget(graph, nearB, viewport, 3, { selectedId: 'A-1-1' })?.targetId).toBe(
    'A-1',
  );
  expect(computeLevelJumpTarget(graph, nearB, viewport, 3, { selectedId: 'A' })?.targetId).toBe(
    'A-1',
  );
  expect(computeLevelJumpTarget(graph, nearB, viewport, 3, { targetId: 'A-3' })).toBeUndefined();
});

it('opens the scheduled level at the chosen frame while keeping deeper nodes collapsed', () => {
  const graph = fixture();
  const area = { x: 13, y: 170, width: 280, height: 380 };
  const target = computeLevelJumpTarget(graph, nearB, viewport, 2, { targetId: 'A', area })!;
  expect(worldToScreen(center(graph.nodes.A!), target.camera, viewport)).toEqual(center(area));
  expect(target.camera.zoom * graph.nodes.A!.width).toBeLessThanOrEqual(area.width);
  const visible = evaluateLod(graph, target.camera.zoom, 0, target.lodFocus);
  expect(visible.get('A')?.detail).toBe(1);
  expect(visible.get('A-1')?.opacity).toBe(1);
  expect(visible.get('A-1')?.detail).toBe(0);
});

it('wraps eligible siblings within a level and steps upward across C4 ancestors', () => {
  const graph = fixture();
  const container = { level: 3, targetId: 'A-1' } as const;
  const system = { level: 2, targetId: 'A' } as const;
  expect(computeSiblingJump(graph, nearB, viewport, container, 'prev')?.targetId).toBe('A-2');
  expect(computeSiblingJump(graph, nearB, viewport, system, 'prev')?.targetId).toBe('B');
  expect(
    computeSiblingJump(graph, nearB, viewport, { level: 3, targetId: 'B-1' }, 'next'),
  ).toBeUndefined();
  expect(computeZoomUpTarget(graph, nearB, viewport, container)).toMatchObject(system);
  expect(computeZoomUpTarget(graph, nearB, viewport, system)?.level).toBe(1);
  expect(computeZoomUpTarget(graph, nearB, viewport, { level: 1 })).toBeUndefined();
});
