import { useMemo } from 'react';
import { useActions, useAppState, useCanvasRuntime, useHud } from '../state/AppStateContext';
import { aimZoom, fitMap, focusLevel, levelParent } from '../state/runtime';

const levels = [
  { id: 1, label: 'Context' },
  { id: 2, label: 'Container' },
  { id: 3, label: 'Component' },
] as const;

export function ZoomControls() {
  const { active, selection } = useAppState();
  const { level, camera } = useHud();
  const runtime = useCanvasRuntime();
  const available = useMemo(
    () => [
      !!active?.graph.workspace.rootIds.length,
      !!active && !!levelParent(active.graph, 2, []),
      !!active && !!levelParent(active.graph, 3, []),
    ],
    [active],
  );
  return (
    <section className="zoom-controls" aria-label="地図の操作">
      <div className="glass depth-controls" role="group" aria-label="C4 レベル">
        {levels.map(({ id, label }) => (
          <button
            type="button"
            key={id}
            aria-pressed={level === id}
            disabled={!available[id - 1]}
            aria-label={`L${id} ${label}`}
            title={`L${id} ${label} (${id})`}
            onClick={() =>
              focusLevel(runtime, id, selection?.kind === 'node' ? selection.id : undefined)
            }
          >
            <span>L{id}</span>
            <span className="level-name">{label}</span>
          </button>
        ))}
        <span className="scale" aria-label="表示倍率">
          {camera.zoom.toFixed(2)}×
        </span>
      </div>
      <div className="glass map-tools" role="group" aria-label="ズームと表示設定">
        <button
          type="button"
          aria-label="ズームイン"
          title="ズームイン (+)"
          onClick={() => aimZoom(runtime, 1.5)}
        >
          ＋
        </button>
        <button
          type="button"
          aria-label="ズームアウト"
          title="ズームアウト (-)"
          onClick={() => aimZoom(runtime, 1 / 1.5)}
        >
          −
        </button>
        <button
          type="button"
          onClick={() => fitMap(runtime)}
          disabled={!active}
          title="全体表示 (0)"
        >
          全体表示
        </button>
        <DisplayOptions className="desktop-display-options" />
      </div>
    </section>
  );
}

export function DisplayOptions({ className }: { className: string }) {
  const { editing, offsets, theme } = useAppState();
  const { dispatch } = useActions();
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => dispatch({ type: 'toggle-edit' })}
        aria-pressed={editing}
        title="配置調整。Alt / Option を押しながらドラッグでも移動できます。"
      >
        配置調整
      </button>
      {Object.keys(offsets).length > 0 && (
        <button
          type="button"
          onClick={() => dispatch({ type: 'reset' })}
          aria-label="全配置をリセット"
          title="全配置をリセット"
        >
          ↺
        </button>
      )}
      <button
        type="button"
        aria-label={theme === 'light' ? 'ダークテーマに変更' : 'ライトテーマに変更'}
        title={theme === 'light' ? 'ダークテーマに変更' : 'ライトテーマに変更'}
        onClick={() => dispatch({ type: 'toggle-theme' })}
      >
        {theme === 'light' ? '☾' : '☼'}
      </button>
    </div>
  );
}
