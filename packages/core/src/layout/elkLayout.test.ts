import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parseStructurizrWorkspaceJson } from '../json/index.js';
import { intersects } from './bounds.js';
import { layoutWorkspace } from './elkLayout.js';
import { applyOffsets } from './offsets.js';
import { layoutPadding } from './types.js';

it.each([
  'fixtures/json/upstream/big-bank-plc.json',
  'fixtures/json/upstream/groups-nested.json',
  'fixtures/json/custom/cloudshop-multi-system.json',
  'docs/architecture/workspace.json',
])('lays out %s deterministically without sibling overlap', async (path) => {
  const workspace = parseStructurizrWorkspaceJson(
    readFileSync(new URL('../../../../' + path, import.meta.url), 'utf8'),
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
});

it('inherits offsets, preserves the base, and expands a parent around a moved child', async () => {
  const base = await layoutWorkspace(
    parseStructurizrWorkspaceJson({
      model: { softwareSystems: [{ id: 's', name: 'S', containers: [{ id: 's.c', name: 'C' }] }] },
    }).workspace!,
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

it('packs the independent components in a container across more than one column', async () => {
  const { workspace } = parseStructurizrWorkspaceJson({
    model: {
      softwareSystems: [
        {
          id: 's',
          name: 'System',
          containers: [
            {
              id: 'c',
              name: 'Container',
              components: Array.from({ length: 7 }, (_, i) => ({
                id: `child-${i}`,
                name: `Child ${i}`,
              })),
            },
          ],
        },
      ],
    },
  });
  const { nodes } = await layoutWorkspace(workspace!);
  const node = nodes.c!;
  expect(node.width).toBeGreaterThan(node.height);
  expect(new Set(node.element.childrenIds.map((id) => nodes[id]!.x)).size).toBeGreaterThan(1);
});
