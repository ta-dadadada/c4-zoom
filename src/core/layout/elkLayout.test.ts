import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parseDsl } from '../dsl/parser';
import { intersects } from './bounds';
import { layoutWorkspace } from './elkLayout';
import { applyOffsets } from './offsets';
import { layoutPadding } from './types';

it.each([
  'fixtures/dsl/upstream/big-bank-plc.dsl',
  'fixtures/dsl/upstream/groups-nested.dsl',
  'fixtures/dsl/custom/cloudshop-multi-system.dsl',
  'docs/architecture/workspace.dsl',
])('lays out %s deterministically without sibling overlap', async (path) => {
  const workspace = parseDsl(
    readFileSync(new URL('../../../' + path, import.meta.url), 'utf8'),
  ).workspace!;
  const graph = await layoutWorkspace(workspace);
  expect(await layoutWorkspace(workspace)).toEqual(graph);
  expect(Object.keys(graph.nodes)).toHaveLength(Object.keys(workspace.elements).length);

  function check(siblings: string[]) {
    for (let i = 0; i < siblings.length; i++) {
      const node = graph.nodes[siblings[i]!]!;
      for (const id of siblings.slice(i + 1))
        expect(intersects(node, graph.nodes[id]!)).toBe(false);
      for (const id of node.element.childrenIds) {
        const child = graph.nodes[id]!;
        expect(child.x).toBeGreaterThanOrEqual(node.x + layoutPadding.side - 0.01);
        expect(child.y).toBeGreaterThanOrEqual(node.y + layoutPadding.top - 0.01);
        expect(child.x + child.width).toBeLessThanOrEqual(
          node.x + node.width - layoutPadding.side + 0.01,
        );
        expect(child.y + child.height).toBeLessThanOrEqual(
          node.y + node.height - layoutPadding.side + 0.01,
        );
      }
      check(node.element.childrenIds);
    }
  }
  check(workspace.rootIds);
  if (path === 'docs/architecture/workspace.dsl') {
    const ui = Object.values(graph.nodes).find((node) => node.element.name === 'Floating Map UI')!;
    expect(ui.width).toBeGreaterThan(ui.height);
    expect(new Set(ui.element.childrenIds.map((id) => graph.nodes[id]!.x)).size).toBeGreaterThan(1);
  }
});

it('inherits offsets, preserves the base, and expands a parent around a moved child', async () => {
  const base = await layoutWorkspace(
    parseDsl('s = softwareSystem "S" { c = container "C" }').workspace!,
  );
  const parentMove = applyOffsets(base, { s: { dx: 37, dy: -3 } });
  const originalParent = base.nodes.s!;
  const originalChild = base.nodes['s.c']!;
  expect(parentMove.nodes['s.c']).toMatchObject({
    x: originalChild.x + 37,
    y: originalChild.y - 3,
  });
  const childMove = applyOffsets(base, { 's.c': { dx: -440, dy: 200 } });
  const child = childMove.nodes['s.c']!;
  const parent = childMove.nodes.s!;
  expect(parent.x).toBeLessThan(originalParent.x);
  expect(parent.x + layoutPadding.side).toBe(child.x);
  expect(parent.y + parent.height - layoutPadding.side).toBe(child.y + child.height);
  expect(applyOffsets(base, {})).toBe(base);
  expect((await layoutWorkspace(base.workspace)).nodes).toEqual(base.nodes);
});
