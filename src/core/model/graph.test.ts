import { expect, it } from 'vitest';
import { parseDsl } from '../dsl/parser';
import { ancestors, descendants, traceDependencies } from './graph';

it('traverses hierarchy and cyclic directed dependencies without revisiting nodes', () => {
  const { workspace } = parseDsl(`
    a = softwareSystem "A" {
      b = container "B" { c = component "C" }
    }
    x = softwareSystem "X"
    y = softwareSystem "Y"
    c -> x
    x -> y
    y -> c
  `);
  expect(ancestors(workspace!, 'a.b.c')).toEqual(['a.b', 'a']);
  expect(descendants(workspace!, 'a')).toEqual(['a.b', 'a.b.c']);
  expect(traceDependencies(workspace!, 'a', 'direct').downstream.nodeIds).toEqual(['x']);
  const trace = traceDependencies(workspace!, 'a', 'transitive');
  expect(trace.upstream.nodeIds).toEqual(['y', 'x']);
  expect(trace.downstream.nodeIds).toEqual(['x', 'y']);
  expect(trace.downstream.relationships).toHaveLength(3);
});

it('keeps internal edges separate and finds the same edge in both transitive directions', () => {
  const workspace = parseDsl(`
    system = softwareSystem "System" {
      box = container "Box" {
        a = component "A"
        b = component "B"
        a -> b "Internal"
      }
      other = container "Other"
      b -> other "Out"
      other -> a "Back"
    }
  `).workspace!;
  const direct = traceDependencies(workspace, 'system.box', 'direct');
  expect(direct.internal.map((edge) => edge.description)).toEqual(['Internal']);
  expect(direct.cyclic).toEqual([]);
  const transitive = traceDependencies(workspace, 'system.box', 'transitive');
  expect(transitive.cyclic.map((edge) => edge.description)).toEqual(['Out', 'Back']);
  expect(transitive.internal).toEqual(direct.internal);
});
