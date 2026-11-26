import { flushSync } from 'react-dom';
import { useMemo, useState } from 'react';
import type { C4Element, C4Relationship, C4Workspace } from '../core/model/types';
import { traceDependencies, type TraceLeg } from '../core/model/graph';
import { useActions, useAppState, useCanvasRuntime } from '../state/AppStateContext';
import { focusCanvas, focusNode, revealNode } from '../state/runtime';
import { kindLabel } from './labels';

function safeUrl(url?: string): string | undefined {
  if (!url) return;
  try {
    const parsed = new URL(url);
    return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

function Metadata({ record }: { record: C4Element | C4Relationship }) {
  const url = safeUrl(record.url);
  const properties = Object.entries(record.properties);
  return (
    <>
      {record.description && <p className="description">{record.description}</p>}
      {(record.technology || record.tags.length > 0 || record.url || properties.length > 0) && (
        <dl className="metadata">
          {record.technology && (
            <div>
              <dt>技術</dt>
              <dd>{record.technology}</dd>
            </div>
          )}
          {record.tags.length > 0 && (
            <div>
              <dt>タグ</dt>
              <dd className="tags">
                {record.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </dd>
            </div>
          )}
          {record.url && (
            <div>
              <dt>URL</dt>
              <dd>
                {url ? (
                  <a href={url} target="_blank" rel="noreferrer">
                    {record.url}
                  </a>
                ) : (
                  record.url
                )}
              </dd>
            </div>
          )}
          {properties.map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}

function TraceList({
  direction,
  leg,
  workspace,
  onJump,
}: {
  direction: 'upstream' | 'downstream';
  leg: TraceLeg;
  workspace: C4Workspace;
  onJump(id: string): void;
}) {
  const upstream = direction === 'upstream';
  return (
    <section className={`trace ${direction}`}>
      <h3>
        {upstream ? '上流' : '下流'} <span>{leg.nodeIds.length}</span>
      </h3>
      {leg.nodeIds.length ? (
        <ul>
          {leg.nodeIds.map((id) => (
            <li key={id}>
              <button type="button" onClick={() => onJump(id)}>
                <span aria-hidden="true">{upstream ? '↙' : '↗'}</span>
                {workspace.elements[id]?.name ?? id}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>接続先なし</p>
      )}
    </section>
  );
}

export function Inspector() {
  const { active, selection, traceMode, editing, offsets } = useAppState();
  const { dispatch } = useActions();
  const runtime = useCanvasRuntime();
  const workspace = active?.graph.workspace;
  const [expanded, setExpanded] = useState(false);
  const nodeId = selection?.kind === 'node' ? selection.id : undefined;
  const trace = useMemo(
    () => (workspace && nodeId ? traceDependencies(workspace, nodeId, traceMode) : undefined),
    [workspace, nodeId, traceMode],
  );
  if (!workspace || !selection) return null;
  const node = nodeId ? workspace.elements[nodeId] : undefined;
  const edge = selection.kind === 'edge' ? selection.edge : undefined;

  function jump(id: string) {
    flushSync(() => dispatch({ type: 'select', selection: { kind: 'node', id } }));
    focusNode(runtime, id);
    focusCanvas(runtime);
  }

  return (
    <aside className="glass inspector" data-expanded={expanded} aria-labelledby="inspector-title">
      <div className="panel-heading inspector-heading">
        <div>
          <p>{node ? `L${node.level} ${kindLabel[node.kind]}` : '関係線'}</p>
          <h2 id="inspector-title">{node?.name ?? edge?.summaryLabel}</h2>
        </div>
        <div className="inspector-actions">
          <button
            type="button"
            className="inspector-expand"
            aria-expanded={expanded}
            aria-controls="inspector-body"
            onClick={() => {
              flushSync(() => setExpanded(!expanded));
              if (nodeId) revealNode(runtime, nodeId);
            }}
          >
            {expanded ? '要約' : '詳しく'}
          </button>
          <button
            type="button"
            aria-label="詳細を閉じる"
            onClick={() => {
              dispatch({ type: 'select', selection: null });
              focusCanvas(runtime);
            }}
          >
            ×
          </button>
        </div>
      </div>
      <div className="inspector-body" id="inspector-body">
        {node && trace && (
          <>
            <Metadata record={node} />
            <div className="trace-heading">
              <h3>依存関係</h3>
              <div className="segmented" role="group" aria-label="トレース範囲">
                <button
                  type="button"
                  aria-pressed={traceMode === 'direct'}
                  onClick={() => dispatch({ type: 'trace', mode: 'direct' })}
                >
                  直接
                </button>
                <button
                  type="button"
                  aria-pressed={traceMode === 'transitive'}
                  onClick={() => dispatch({ type: 'trace', mode: 'transitive' })}
                >
                  推移的
                </button>
              </div>
            </div>
            {trace.cyclic.length > 0 && (
              <p className="cyclic-legend">
                <span aria-hidden="true" />
                循環経路 {trace.cyclic.length} 件
              </p>
            )}
            <TraceList
              direction="upstream"
              leg={trace.upstream}
              workspace={workspace}
              onJump={jump}
            />
            <TraceList
              direction="downstream"
              leg={trace.downstream}
              workspace={workspace}
              onJump={jump}
            />
            {(editing || Object.hasOwn(offsets, node.id)) && (
              <section className="inspector-layout">
                <h3>要素の位置</h3>
                {editing && (
                  <div className="nudge" role="group" aria-label="要素の位置を調整">
                    {[
                      { x: -1, y: 0, label: '左', symbol: '←' },
                      { x: 0, y: -1, label: '上', symbol: '↑' },
                      { x: 0, y: 1, label: '下', symbol: '↓' },
                      { x: 1, y: 0, label: '右', symbol: '→' },
                    ].map(({ x, y, label, symbol }) => (
                      <button
                        type="button"
                        key={label}
                        aria-label={`要素を${label}に移動`}
                        onClick={() =>
                          dispatch({
                            type: 'move',
                            id: node.id,
                            relative: true,
                            offset: { dx: x * 24, dy: y * 24 },
                          })
                        }
                      >
                        {symbol}
                      </button>
                    ))}
                  </div>
                )}
                {Object.hasOwn(offsets, node.id) && (
                  <button type="button" onClick={() => dispatch({ type: 'reset', id: node.id })}>
                    この要素の位置をリセット
                  </button>
                )}
              </section>
            )}
          </>
        )}
        {edge && (
          <>
            <div className="edge-endpoints">
              <button type="button" onClick={() => jump(edge.sourceId)}>
                {workspace.elements[edge.sourceId]?.name}
              </button>
              <span aria-label="から">→</span>
              <button type="button" onClick={() => jump(edge.targetId)}>
                {workspace.elements[edge.targetId]?.name}
              </button>
            </div>
            <section className="edge-relationships">
              <h3>
                関係の内訳 <span>{edge.count} 件</span>
              </h3>
              <ul>
                {workspace.relationships
                  .filter((item) => edge.underlyingIds.includes(item.id))
                  .map((item) => (
                    <li key={item.id}>
                      <h4>
                        {workspace.elements[item.sourceId]?.name} →{' '}
                        {workspace.elements[item.targetId]?.name}
                      </h4>
                      <Metadata record={item} />
                    </li>
                  ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </aside>
  );
}
