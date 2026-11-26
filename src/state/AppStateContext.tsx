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
import type { Offsets, Offset, PositionedGraph } from '../core/layout/types';
import type { TraceMode } from '../core/model/graph';
import type { DslDiagnostic } from '../core/model/types';
import type { DisplayEdge } from '../core/lod/edgeRollup';
import type { ThemeName } from '../core/renderer/theme';
import { defaultSample, samples } from '../samples';
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
import type { LayoutRequest, LayoutResponse } from './workspace.worker';

export type AppSelection = { kind: 'node'; id: string } | { kind: 'edge'; edge: DisplayEdge };

interface ActiveWorkspace {
  source: Source;
  graph: PositionedGraph;
  key: string;
}

interface AppState {
  active: ActiveWorkspace | null;
  pending: string | null;
  attempt: string | null;
  diagnostics: DslDiagnostic[];
  selection: AppSelection | null;
  traceMode: TraceMode;
  editing: boolean;
  theme: ThemeName;
  offsets: Offsets;
  storageError: boolean;
}

type Action =
  | { type: 'pending'; name: string }
  | { type: 'loaded'; active: ActiveWorkspace; diagnostics: DslDiagnostic[]; offsets: Offsets }
  | { type: 'failed'; name: string; diagnostics: DslDiagnostic[] }
  | { type: 'select'; selection: AppSelection | null }
  | { type: 'trace'; mode: TraceMode }
  | { type: 'toggle-edit' }
  | { type: 'toggle-theme' }
  | { type: 'move'; id: string; offset: Offset; relative: boolean }
  | { type: 'reset'; id?: string }
  | { type: 'storage-error' };

const fallback: Source = { kind: 'sample', id: defaultSample.id };

function initialState(): AppState {
  return {
    active: null,
    pending: null,
    attempt: null,
    diagnostics: [],
    selection: null,
    traceMode: 'direct',
    editing: false,
    theme: storedTheme(),
    offsets: {},
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
      if (!state.active?.graph.nodes[action.id]) return state;
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

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const runtimeRef = useRef<Runtime | null>(null);
  runtimeRef.current ??= createRuntime();
  const runtime = runtimeRef.current;
  const worker = useRef<Worker | null>(null);
  const generation = useRef(0);

  const newRequest = useCallback((name: string) => {
    worker.current?.terminate();
    worker.current = null;
    dispatch({ type: 'pending', name });
    return ++generation.current;
  }, []);

  const run = useCallback(
    function run(source: Source, requestId: number, restore = false) {
      if (requestId !== generation.current) return;
      const name = sourceName(source);
      const text =
        source.kind === 'file'
          ? source.text
          : samples.find((sample) => sample.id === source.id)?.text;
      function receive({ graph, diagnostics }: LayoutResponse) {
        if (requestId !== generation.current) return;
        worker.current?.terminate();
        worker.current = null;
        if (!graph && restore) {
          run(fallback, newRequest(sourceName(fallback)));
          return;
        }
        if (!graph) {
          dispatch({ type: 'failed', name, diagnostics });
          return;
        }
        const key = workspaceKey(source, graph.workspace.name);
        dispatch({
          type: 'loaded',
          active: { source, graph, key },
          diagnostics,
          offsets: storedOffsets(key),
        });
      }

      if (text === undefined) {
        receive({ graph: null, diagnostics: [loadDiagnostic('サンプルが見つかりません。')] });
        return;
      }

      try {
        const instance = new Worker(new URL('./workspace.worker.ts', import.meta.url), {
          type: 'module',
        });
        worker.current = instance;
        instance.onmessage = (event: MessageEvent<LayoutResponse>) => receive(event.data);
        instance.onerror = () =>
          receive({
            graph: null,
            diagnostics: [loadDiagnostic('地図の生成処理を開始できませんでした。')],
          });
        instance.postMessage({ text } satisfies LayoutRequest);
      } catch {
        receive({
          graph: null,
          diagnostics: [loadDiagnostic('地図の生成処理を開始できませんでした。')],
        });
      }
    },
    [newRequest],
  );

  const actions = useMemo<Actions>(
    () => ({
      dispatch,
      loadSample(id) {
        const source: Source = { kind: 'sample', id };
        run(source, newRequest(sourceName(source)));
      },
      loadFile(file) {
        const request = newRequest(file.name);
        if (!/\.dsl$/i.test(file.name)) {
          dispatch({
            type: 'failed',
            name: file.name,
            diagnostics: [loadDiagnostic('.dsl ファイルを選択してください。')],
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
    [newRequest, run],
  );

  useEffect(() => {
    const saved = storedSource();
    const source = saved ?? fallback;
    run(source, newRequest(sourceName(source)), saved !== undefined);
    return () => {
      generation.current++;
      worker.current?.terminate();
    };
  }, [newRequest, run]);

  useEffect(() => {
    if (state.active && !saveSource(state.active.source)) dispatch({ type: 'storage-error' });
  }, [state.active]);
  useEffect(() => {
    if (state.active && !saveOffsets(state.active.key, state.offsets))
      dispatch({ type: 'storage-error' });
  }, [state.active, state.offsets]);
  useEffect(() => {
    if (!saveTheme(state.theme)) dispatch({ type: 'storage-error' });
  }, [state.theme]);

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
