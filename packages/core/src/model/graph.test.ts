import { expect, it } from 'vitest';
import { parseStructurizrWorkspaceJson } from '../json/index.js';
import { ancestors, descendants, traceDependencies } from './graph.js';

function edge(sourceId: string, destinationId: string, description?: string) {
  return { id: `${sourceId}>${destinationId}`, sourceId, destinationId, description };
}

it('traverses hierarchy and cyclic directed dependencies without revisiting nodes', () => {
  const { workspace } = parseStructurizrWorkspaceJson({
    model: {
      softwareSystems: [
        {
          id: 'a',
          name: 'A',
          containers: [
            {
              id: 'a.b',
              name: 'B',
              components: [{ id: 'a.b.c', name: 'C', relationships: [edge('a.b.c', 'x')] }],
            },
          ],
        },
        { id: 'x', name: 'X', relationships: [edge('x', 'y')] },
        { id: 'y', name: 'Y', relationships: [edge('y', 'a.b.c')] },
      ],
    },
  });
  expect(ancestors(workspace!, 'a.b.c')).toEqual(['a.b', 'a']);
  expect(descendants(workspace!, 'a')).toEqual(['a.b', 'a.b.c']);
  expect(traceDependencies(workspace!, 'a', 'direct').downstream.nodeIds).toEqual(['x']);
  const trace = traceDependencies(workspace!, 'a', 'transitive');
  expect(trace.upstream.nodeIds).toEqual(['y', 'x']);
  expect(trace.downstream.nodeIds).toEqual(['x', 'y']);
  expect(trace.downstream.relationships).toHaveLength(3);
});

it('keeps internal edges separate and finds the same edge in both transitive directions', () => {
  const { workspace } = parseStructurizrWorkspaceJson({
    model: {
      softwareSystems: [
        {
          id: 'system',
          name: 'System',
          containers: [
            {
              id: 'system.box',
              name: 'Box',
              components: [
                { id: 'a', name: 'A', relationships: [edge('a', 'b', 'Internal')] },
                { id: 'b', name: 'B', relationships: [edge('b', 'other', 'Out')] },
              ],
            },
            { id: 'other', name: 'Other', relationships: [edge('other', 'a', 'Back')] },
          ],
        },
      ],
    },
  });
  const direct = traceDependencies(workspace!, 'system.box', 'direct');
  expect(direct.internal.map((link) => link.description)).toEqual(['Internal']);
  expect(direct.cyclic).toEqual([]);
  const transitive = traceDependencies(workspace!, 'system.box', 'transitive');
  expect(transitive.cyclic.map((link) => link.description)).toEqual(['Out', 'Back']);
  expect(transitive.internal).toEqual(direct.internal);
});
