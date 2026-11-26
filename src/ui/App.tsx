import { useEffect, useLayoutEffect, useRef } from 'react';
import { useActions, useAppState, useCanvasRuntime } from '../state/AppStateContext';
import { aimZoom, fitMap, focusCanvas, focusLevel } from '../state/runtime';
import { Breadcrumbs } from './Breadcrumbs';
import { Inspector } from './Inspector';
import { MapCanvas } from './MapCanvas';
import { Minimap } from './Minimap';
import { SearchBar } from './SearchBar';
import { SourceControls } from './SourceControls';
import { ZoomControls } from './ZoomControls';

function openDsl() {
  document.getElementById('dsl-file')?.click();
}

export function App() {
  const { active, pending, attempt, selection, theme, editing, storageError } = useAppState();
  const runtime = useCanvasRuntime();
  const { dispatch } = useActions();
  const root = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const app = root.current!;
    const top = app.querySelector('.top-bar');
    const controls = app.querySelector('.zoom-controls');
    const inspector = app.querySelector('.inspector');
    const mobile = matchMedia('(max-width: 620px)');
    function measure() {
      const { width, height, x, y } = app.getBoundingClientRect();
      const detail = inspector?.getBoundingClientRect();
      const left = 10;
      const right = Math.max(
        left + 1,
        !mobile.matches && detail?.width ? detail.left - x - 10 : width - 10,
      );
      const bottom = Math.max(
        1,
        Math.min(
          (controls?.getBoundingClientRect().top ?? y + height) - y - 8,
          mobile.matches && detail?.height ? detail.top - y - 8 : height,
        ),
      );
      const firstRow = Math.max(8, (top?.getBoundingClientRect().bottom ?? y) - y + 8);
      const upper = Math.max(0, Math.min(firstRow, bottom - Math.min(64, bottom)));
      const area = { x: left, y: upper, width: right - left, height: bottom - upper };
      const previous = runtime.safeArea;
      if (
        !previous ||
        previous.x !== area.x ||
        previous.y !== area.y ||
        previous.width !== area.width ||
        previous.height !== area.height
      ) {
        runtime.safeArea = area;
        runtime.dirty = true;
      }
      return area;
    }

    runtime.measureSafeArea = measure;
    measure();
    const observer = new ResizeObserver(measure);
    for (const element of [app, top, controls, inspector]) if (element) observer.observe(element);
    return () => {
      observer.disconnect();
      runtime.measureSafeArea = undefined;
    };
  }, [runtime, selection]);

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || document.querySelector('dialog[open]'))
        return;
      const key = event.key.toLowerCase();
      if (key === 'tab') runtime.canvas?.setAttribute('data-keyboard-focus', '');
      const typing =
        event.target instanceof HTMLElement &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) ||
          event.target.isContentEditable);
      if (
        ((event.metaKey || event.ctrlKey) && key === 'k') ||
        (!typing && !event.metaKey && !event.ctrlKey && !event.altKey && key === '/')
      ) {
        event.preventDefault();
        document.getElementById('spot-search')?.focus();
        return;
      }
      if (key === 'escape' && selection) {
        event.preventDefault();
        dispatch({ type: 'select', selection: null });
        focusCanvas(runtime);
        return;
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      switch (key) {
        case '0':
          fitMap(runtime);
          break;
        case '+':
        case '=':
          aimZoom(runtime, 1.5);
          break;
        case '-':
          aimZoom(runtime, 1 / 1.5);
          break;
        case '1':
        case '2':
        case '3':
          focusLevel(
            runtime,
            key === '1' ? 1 : key === '2' ? 2 : 3,
            selection?.kind === 'node' ? selection.id : undefined,
          );
          break;
        case 'o':
          openDsl();
          break;
        default:
          return;
      }
      event.preventDefault();
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [runtime, selection, dispatch]);

  const empty = active ? active.graph.workspace.rootIds.length === 0 : !pending;
  return (
    <main
      ref={root}
      className="app"
      data-theme={theme}
      data-editing={editing}
      data-inspecting={!!selection}
    >
      <header className="top-bar">
        <SearchBar />
        <Breadcrumbs />
        <SourceControls />
      </header>
      <MapCanvas />
      <p className="sr-only" id="map-keys">
        矢印キーで移動、プラスとマイナスで拡大縮小、0 で全体表示。Enter で現在地の要素を選択します。
        スラッシュで要素を検索できます。
      </p>
      {empty && (active || attempt) && (
        <section className="glass map-message">
          <h1>{active ? '表示できる要素がありません' : '地図を表示できませんでした'}</h1>
          <p>別の DSL ファイルを開くか、サンプルを選んでください。</p>
          <button type="button" onClick={openDsl}>
            DSL を開く
          </button>
        </section>
      )}
      {!active && pending && (
        <p className="glass map-message" aria-hidden="true">
          地図を生成中…
        </p>
      )}
      <ZoomControls />
      <Minimap />
      <Inspector key={selection?.kind === 'node' ? selection.id : selection?.edge.id} />
      {storageError && (
        <p className="glass storage-warning" role="status">
          ブラウザに保存できませんでした。変更はこの画面を開いている間だけ保持されます。
        </p>
      )}
    </main>
  );
}
