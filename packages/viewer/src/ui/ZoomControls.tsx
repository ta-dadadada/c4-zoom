import { memo, useMemo, useRef } from 'react';
import { listLevelJumpTargets, type LevelJumpTargets } from '@c4-zoom/core/camera/levelJump';
import { useActions, useAppState, useCanvasRuntime, useHud } from '../state/AppStateContext';
import { aimZoom, fitMap, focusLevel, focusLevelTarget } from '../state/runtime';

const levels = [
  { id: 1, label: 'Context' },
  { id: 2, label: 'Container' },
  { id: 3, label: 'Component' },
] as const;

const noTargets: LevelJumpTargets = { l1: false, l2: [], l3: [] };

const LevelJumpMenu = memo(function LevelJumpMenu({ targets }: { targets: LevelJumpTargets }) {
  const runtime = useCanvasRuntime();
  const popover = useRef<HTMLDivElement>(null);
  const bySystem = new Map<string, LevelJumpTargets['l3']>();
  for (const target of targets.l3) {
    const group = bySystem.get(target.systemId);
    if (group) group.push(target);
    else bySystem.set(target.systemId, [target]);
  }

  function jump(level: 1 | 2 | 3, id?: string) {
    popover.current?.hidePopover();
    if (level === 1) fitMap(runtime);
    else if (id) focusLevelTarget(runtime, level, id);
  }

  return (
    <>
      <button
        type="button"
        popoverTarget="level-jump-targets"
        aria-label="レベル別クイックジャンパー"
        title="レベル別クイックジャンパー"
        disabled={!targets.l1}
      >
        一覧
      </button>
      <div
        ref={popover}
        id="level-jump-targets"
        className="glass level-jump-popover"
        popover="auto"
        role="region"
        aria-label="レベル別の移動先"
      >
        <section>
          <h2>L1 Context</h2>
          <button type="button" onClick={() => jump(1)}>
            Landscape（全体俯瞰）
          </button>
        </section>
        {targets.l2.length > 0 && (
          <section>
            <h2>L2 Container</h2>
            <ul>
              {targets.l2.map((target) => (
                <li key={target.id}>
                  <button type="button" onClick={() => jump(2, target.id)}>
                    <span>{target.name}</span>
                    <span className="level-jump-count">{target.childCount} コンテナ</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {bySystem.size > 0 && (
          <section>
            <h2>L3 Component</h2>
            {[...bySystem].map(([id, containers]) => (
              <div key={id}>
                <h3>{containers[0]!.systemName}</h3>
                <ul>
                  {containers.map((target) => (
                    <li key={target.id}>
                      <button type="button" onClick={() => jump(3, target.id)}>
                        <span>{target.name}</span>
                        <span className="level-jump-count">{target.childCount} コンポーネント</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}
      </div>
    </>
  );
});

export function ZoomControls() {
  const { active, selection } = useAppState();
  const { level, camera } = useHud();
  const runtime = useCanvasRuntime();
  const targets = useMemo(
    () => (active ? listLevelJumpTargets(active.graph) : noTargets),
    [active],
  );
  const available = [targets.l1, targets.l2.length > 0, targets.l3.length > 0];
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
        <LevelJumpMenu targets={targets} />
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
