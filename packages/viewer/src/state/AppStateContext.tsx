import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { maxWorkspaceJsonBytes, type WorkspaceDiagnostic } from '@c4-zoom/core/json';
import type { C4ZoomBootstrapPayload } from '@c4-zoom/core/export';
import type { Offsets, Offset, PositionedGraph } from '@c4-zoom/core/layout/types';
import type { TraceMode } from '@c4-zoom/core/model/graph';
import type { DisplayEdge } from '@c4-zoom/core/lod/edgeRollup';
import type { ThemeName } from '@c4-zoom/core/renderer/theme';
import type { Viewer } from '../viewer';
import {
  saveOffsets,
  saveSource,
  saveTheme,
  storedOffsets,
  storedSource,
  storedTheme,
  workspaceKey,
} from './persistence';
import { createRuntime, type Runtime } from './runtime';
import { loadDiagnostic, sourceName, type Source } from './source';
import { computeLayout, type LayoutResponse } from './layoutRunner';

export type AppSelection = { kind: 'node'; id: string } | { kind: 'edge'; edge: DisplayEdge };

interface ActiveWorkspace {
  source: Source;
  graph: PositionedGraph;
  key: string;
  initialCamera?: C4ZoomBootstrapPayload['initialCamera'];
}

interface AppState {
  viewer: Viewer;
  allowFileDrop: boolean;
  active: ActiveWorkspace | null;
  pending: string | null;
  attempt: string | null;
  diagnostics: WorkspaceDiagnostic[];
  selection: AppSelection | null;
  traceMode: TraceMode;
  editing: boolean;
  theme: ThemeName;
  offsets: Offsets;
  storageError: boolean;
}

type Action =
  | { type: 'pending'; name: string }
  | {
      type: 'loaded';
      active: ActiveWorkspace;
      diagnostics: WorkspaceDiagnostic[];
      offsets: Offsets;
    }
  | { type: 'failed'; name: string; diagnostics: WorkspaceDiagnostic[] }
  | { type: 'select'; selection: AppSelection | null }
  | { type: 'trace'; mode: TraceMode }
  | { type: 'toggle-edit' }
  | { type: 'toggle-theme' }
  | { type: 'move'; id: string; offset: Offset; relative: boolean }
  | { type: 'reset'; id?: string }
  | { type: 'storage-error' };

function restoreGraphDictionaries(graph: PositionedGraph): PositionedGraph {
  // JSON と structured clone は辞書の null プロトタイプを保持しない。
  Object.setPrototypeOf(graph.workspace.elements, null);
  Object.setPrototypeOf(graph.nodes, null);
  return graph;
}

function embeddedWorkspace(
  payload: C4ZoomBootstrapPayload,
  graph: PositionedGraph,
): ActiveWorkspace {
  const source = { kind: 'embedded', name: payload.workspace.name } as const;
  return {
    source,
    graph: restoreGraphDictionaries({ ...graph, workspace: payload.workspace }),
    key: '',
    initialCamera: payload.initialCamera,
  };
}

function initialState(viewer: Viewer): AppState {
  const payload = viewer.mode === 'standalone' ? viewer.payload : undefined;
  const active = payload?.precomputedLayout
    ? embeddedWorkspace(payload, payload.precomputedLayout)
    : null;
  const missingPayload = viewer.mode === 'standalone' && !payload;
  return {
    viewer,
    allowFileDrop: viewer.mode === 'sample-site' || payload?.allowFileDrop === true,
    active,
    pending: payload && !active ? payload.workspace.name : null,
    attempt: missingPayload ? '埋め込みモデル' : null,
    diagnostics: missingPayload
      ? [loadDiagnostic('対応する埋め込みモデルを読み込めませんでした。')]
      : [],
    selection: null,
    traceMode: 'direct',
    editing: false,
    theme: viewer.mode === 'sample-site' ? storedTheme() : (payload?.theme ?? 'light'),
    offsets: payload?.layoutOverrides?.offsets ?? {},
    storageError: false,
  };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'pending':
      return { ...state, pending: action.name, attempt: null, diagnostics: [] };
    case 'loaded':
      return {
        ...state,
        active: action.active,
        pending: null,
        attempt: null,
        diagnostics: action.diagnostics,
        offsets: action.offsets,
        selection: null,
      };
    case 'failed':
      return { ...state, pending: null, attempt: action.name, diagnostics: action.diagnostics };
    case 'select':
      return { ...state, selection: action.selection };
    case 'trace':
      return { ...state, traceMode: action.mode };
    case 'toggle-edit':
      return { ...state, editing: !state.editing };
    case 'toggle-theme':
      return { ...state, theme: state.theme === 'light' ? 'dark' : 'light' };
    case 'move': {
      if (!state.active || !Object.hasOwn(state.active.graph.nodes, action.id)) return state;
      const current = Object.hasOwn(state.offsets, action.id)
        ? state.offsets[action.id]
        : undefined;
      const { dx, dy } = action.offset;
      const offset =
        action.relative && current ? { dx: dx + current.dx, dy: dy + current.dy } : action.offset;
      return { ...state, offsets: { ...state.offsets, [action.id]: offset } };
    }
    case 'reset': {
      const offsets = action.id ? { ...state.offsets } : {};
      if (action.id) delete offsets[action.id];
      return { ...state, offsets };
    }
    case 'storage-error':
      return state.storageError ? state : { ...state, storageError: true };
  }
}

const StateContext = createContext<AppState | null>(null);
const RuntimeContext = createContext<Runtime | null>(null);

interface Actions {
  dispatch: React.Dispatch<Action>;
  loadSample(id: string): void;
  loadFile(file: File): void;
}

const ActionsContext = createContext<Actions | null>(null);

export function AppStateProvider({ viewer, children }: { viewer: Viewer; children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, viewer, initialState);
  const runtimeRef = useRef<Runtime | null>(null);
  runtimeRef.current ??= createRuntime();
  const runtime = runtimeRef.current;
  const worker = useRef<Worker | null>(null);
  const generation = useRef(0);
  const isSite = viewer.mode === 'sample-site';

  const newRequest = useCallback((name: string) => {
    worker.current?.terminate();
    worker.current = null;
    dispatch({ type: 'pending', name });
    return ++generation.current;
  }, []);

  const run = useCallback(
    function run(source: Source, requestId: number, restore = false) {
      if (requestId !== generation.current) return;
      const samples = viewer.mode === 'sample-site' ? viewer.samples : [];
      const name = sourceName(source, samples);
      const input =
        source.kind === 'file'
          ? source.text
          : source.kind === 'sample'
            ? samples.find((sample) => sample.id === source.id)?.text
            : viewer.mode === 'standalone'
              ? viewer.payload?.workspace
              : undefined;

      function receive({ graph, diagnostics }: LayoutResponse) {
        if (requestId !== generation.current) return;
        worker.current?.terminate();
        worker.current = null;
        if (!graph && restore && samples[0]) {
          run({ kind: 'sample', id: samples[0].id }, newRequest(samples[0].name));
          return;
        }
        if (!graph) {
          dispatch({ type: 'failed', name, diagnostics });
          return;
        }
        const embedded =
          source.kind === 'embedded' && viewer.mode === 'standalone' ? viewer.payload : undefined;
        const key = workspaceKey(source, graph.workspace.name);
        dispatch({
          type: 'loaded',
          active: embedded
            ? embeddedWorkspace(embedded, graph)
            : { source, graph: restoreGraphDictionaries(graph), key },
          diagnostics,
          offsets: embedded?.layoutOverrides?.offsets ?? (isSite ? storedOffsets(key) : {}),
        });
      }

      if (input === undefined) {
        receive({ graph: null, diagnostics: [loadDiagnostic('モデルが見つかりません。')] });
        return;
      }

      const onMainThread = () => void computeLayout(input).then(receive);

      if (
        viewer.mode === 'sample-site' &&
        location.protocol !== 'file:' &&
        typeof input === 'string'
      ) {
        try {
          const instance = viewer.createWorker();
          worker.current = instance;
          instance.onmessage = (event: MessageEvent<LayoutResponse>) => receive(event.data);
          instance.onerror = (event) => {
            event.preventDefault();
            if (requestId !== generation.current || worker.current !== instance) return;
            instance.terminate();
            worker.current = null;
            onMainThread();
          };
          instance.postMessage(input);
          return;
        } catch {
          worker.current?.terminate();
          worker.current = null;
        }
      }
      onMainThread();
    },
    [isSite, newRequest, viewer],
  );

  const actions = useMemo<Actions>(
    () => ({
      dispatch,
      loadSample(id) {
        if (viewer.mode !== 'sample-site') return;
        const source: Source = { kind: 'sample', id };
        run(source, newRequest(sourceName(source, viewer.samples)));
      },
      loadFile(file) {
        if (!state.allowFileDrop) return;
        const request = newRequest(file.name);
        if (!/\.json$/i.test(file.name) || file.size > maxWorkspaceJsonBytes) {
          dispatch({
            type: 'failed',
            name: file.name,
            diagnostics: [
              loadDiagnostic(
                file.size > maxWorkspaceJsonBytes
                  ? '32 MiB 以下の workspace.json を選択してください。'
                  : 'Structurizr が出力した .json ファイルを選択してください。',
              ),
            ],
          });
          return;
        }
        void file.text().then(
          (text) => run({ kind: 'file', name: file.name, text }, request),
          () => {
            if (request === generation.current)
              dispatch({
                type: 'failed',
                name: file.name,
                diagnostics: [loadDiagnostic('ファイルを読み込めませんでした。')],
              });
          },
        );
      },
    }),
    [newRequest, run, state.allowFileDrop, viewer],
  );

  useEffect(() => {
    if (viewer.mode === 'sample-site') {
      const saved = storedSource();
      const first = viewer.samples[0];
      const source = saved ?? (first && { kind: 'sample' as const, id: first.id });
      if (source) run(source, newRequest(sourceName(source, viewer.samples)), !!saved);
    } else if (viewer.payload && !viewer.payload.precomputedLayout) {
      const name = viewer.payload.workspace.name;
      run({ kind: 'embedded', name }, newRequest(name));
    }
    return () => {
      generation.current++;
      worker.current?.terminate();
    };
  }, [newRequest, run, viewer]);

  useEffect(() => {
    if (isSite && state.active && !saveSource(state.active.source))
      dispatch({ type: 'storage-error' });
  }, [isSite, state.active]);
  useEffect(() => {
    if (isSite && state.active && !saveOffsets(state.active.key, state.offsets))
      dispatch({ type: 'storage-error' });
  }, [isSite, state.active, state.offsets]);
  useEffect(() => {
    if (isSite && !saveTheme(state.theme)) dispatch({ type: 'storage-error' });
  }, [isSite, state.theme]);

  return (
    <ActionsContext value={actions}>
      <RuntimeContext value={runtime}>
        <StateContext value={state}>{children}</StateContext>
      </RuntimeContext>
    </ActionsContext>
  );
}

export const useAppState = () => useContext(StateContext)!;
export const useActions = () => useContext(ActionsContext)!;
export const useCanvasRuntime = () => useContext(RuntimeContext)!;

export function useHud() {
  const runtime = useCanvasRuntime();
  return useSyncExternalStore(runtime.subscribe, () => runtime.hud);
}
