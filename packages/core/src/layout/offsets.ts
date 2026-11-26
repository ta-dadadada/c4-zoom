import { graphBounds, union } from './bounds.js';
import {
  layoutPadding,
  type Offsets,
  type PositionedElement,
  type PositionedGraph,
  type Rect,
} from './types.js';

export function applyOffsets(graph: PositionedGraph, offsets: Offsets): PositionedGraph {
  if (!Object.keys(offsets).length) return graph;
  const nodes: Record<string, PositionedElement> = Object.create(null);
  const { top, side } = layoutPadding;

  function move(id: string, parentX: number, parentY: number): Rect {
    const node = graph.nodes[id]!;
    const offset = Object.hasOwn(offsets, id) ? offsets[id] : undefined;
    const dx = parentX + (offset?.dx ?? 0);
    const dy = parentY + (offset?.dy ?? 0);
    let bounds: Rect = { x: node.x + dx, y: node.y + dy, width: node.width, height: node.height };
    for (const childId of node.element.childrenIds) {
      const child = move(childId, dx, dy);
      bounds = union(bounds, {
        x: child.x - side,
        y: child.y - top,
        width: child.width + 2 * side,
        height: child.height + top + side,
      });
    }
    nodes[id] = { ...bounds, element: node.element };
    return bounds;
  }
  graph.workspace.rootIds.forEach((id) => move(id, 0, 0));
  return { ...graph, nodes, bounds: graphBounds(graph.workspace.rootIds, nodes) };
}
