import { flushSync } from 'react-dom';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { applyOffsets } from '../core/layout/offsets';
import type { PositionedGraph } from '../core/layout/types';
import { ancestors, descendants, traceDependencies, type TraceMode } from '../core/model/graph';
import type { Highlight } from '../core/renderer/canvasRenderer';
import {
  useActions,
  useAppState,
  useCanvasRuntime,
  type AppSelection,
} from '../state/AppStateContext';
import { fitMap, focusNode, revealNode } from '../state/runtime';
import { attachMapInput } from './mapInput';
import { attachMapLoop, type RenderInputs } from './mapLoop';

function traceHighlight(
  graph: PositionedGraph | null,
  selection: AppSelection | null,
  mode: TraceMode,
): Highlight | undefined {
  if (!graph || !selection) return;
  const { workspace } = graph;
  const nodes = new Set<string>();
  let upstream = new Set<string>();
  let downstream = new Set<string>();
  let internal = new Set<string>();
  let cyclic = new Set<string>();
  if (selection.kind === 'node') {
    const trace = traceDependencies(workspace, selection.id, mode);
    nodes.add(selection.id);
    for (const id of [
      ...descendants(workspace, selection.id),
      ...trace.upstream.nodeIds,
      ...trace.downstream.nodeIds,
    ])
      nodes.add(id);
    upstream = new Set(trace.upstream.relationships.map((edge) => edge.id));
    downstream = new Set(trace.downstream.relationships.map((edge) => edge.id));
    internal = new Set(trace.internal.map((edge) => edge.id));
    cyclic = new Set(trace.cyclic.map((edge) => edge.id));
  } else {
    downstream = new Set(selection.edge.underlyingIds);
    for (const edge of workspace.relationships) {
      if (downstream.has(edge.id)) {
        nodes.add(edge.sourceId);
        nodes.add(edge.targetId);
      }
    }
  }
  for (const id of nodes) for (const parent of ancestors(workspace, id)) nodes.add(parent);
  return { nodes, upstream, downstream, internal, cyclic };
}

export function MapCanvas() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const runtime = useCanvasRuntime();
  const { dispatch } = useActions();
  const { active, selection, traceMode, theme, offsets, editing } = useAppState();
  const inputs = useRef<RenderInputs & { editing: boolean }>({
    base: null,
    graph: null,
    offsets: {},
    theme: 'light',
    selection: null,
    editing: false,
  });
  const cancelGesture = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    const base = active?.graph ?? null;
    const changedSource = base !== inputs.current.base;
    const changedOffsets = offsets !== inputs.current.offsets;
    const graph =
      base &&
      (changedSource || changedOffsets ? applyOffsets(base, offsets) : inputs.current.graph);
    inputs.current = {
      base,
      graph,
      offsets,
      theme,
      selection,
      highlight: traceHighlight(base, selection, traceMode),
      editing,
    };
    if (changedSource) {
      cancelGesture.current?.();
      runtime.graph = graph;
      runtime.scene = { nodes: [], edges: [] };
      runtime.hover = null;
      runtime.pointer = null;
      fitMap(runtime, false);
    }
    runtime.dirty = true;
  }, [active, selection, traceMode, theme, offsets, editing, runtime]);

  useEffect(() => {
    const element = canvas.current!;
    const readInputs = () => inputs.current;
    const input = attachMapInput(
      element,
      runtime,
      readInputs,
      (hit, navigate) => {
        const edge =
          hit?.kind === 'edge'
            ? runtime.displayEdges.find((item) => item.id === hit.id)
            : undefined;
        const selection =
          hit?.kind === 'node' ? hit : edge ? { kind: 'edge' as const, edge } : null;
        if (selection?.kind === 'node') {
          flushSync(() => dispatch({ type: 'select', selection }));
          if (navigate) focusNode(runtime, selection.id, true);
          else revealNode(runtime, selection.id);
        } else dispatch({ type: 'select', selection });
      },
      (id, offset) => {
        dispatch({ type: 'move', id, offset, relative: false });
        const selection = inputs.current.selection;
        if (selection?.kind !== 'node' || selection.id !== id)
          dispatch({ type: 'select', selection: { kind: 'node', id } });
      },
    );
    cancelGesture.current = input.cancel;
    const stopLoop = attachMapLoop(element, runtime, readInputs, input.isDragging);
    return () => {
      stopLoop();
      input.dispose();
      cancelGesture.current = null;
    };
  }, [dispatch, runtime]);

  return (
    <canvas
      ref={canvas}
      className="map-canvas"
      tabIndex={0}
      aria-label="C4 アーキテクチャ地図"
      aria-describedby="map-keys"
    />
  );
}
