import { flushSync } from 'react-dom';
import { useMemo, useState, type KeyboardEvent } from 'react';
import { useActions, useAppState, useCanvasRuntime } from '../state/AppStateContext';
import { focusCanvas, focusNode } from '../state/runtime';
import { kindLabel } from './labels';

export function SearchBar() {
  const { active } = useAppState();
  const { dispatch } = useActions();
  const runtime = useCanvasRuntime();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const search = query.trim().toLocaleLowerCase();
  const workspace = active?.graph.workspace;
  const entries = useMemo(
    () =>
      Object.values(workspace?.elements ?? {}).map((node) => ({
        node,
        name: node.name.toLocaleLowerCase(),
        search: [node.name, node.description, node.technology, ...node.tags]
          .join(' ')
          .toLocaleLowerCase(),
      })),
    [workspace],
  );
  const shown = open && !!search;
  const results = search
    ? entries
        .filter((entry) => search.split(/\s+/).every((term) => entry.search.includes(term)))
        .sort((a, b) => Number(b.name.startsWith(search)) - Number(a.name.startsWith(search)))
        .slice(0, 10)
        .map(({ node }) => node)
    : [];
  const current = Math.min(index, Math.max(0, results.length - 1));

  function choose(id: string) {
    flushSync(() => dispatch({ type: 'select', selection: { kind: 'node', id } }));
    focusNode(runtime, id);
    setOpen(false);
    setQuery('');
    setIndex(0);
    focusCanvas(runtime);
  }

  function keydown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      focusCanvas(runtime);
    }
    if (results.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      const next = event.key === 'ArrowDown' ? current + 1 : current - 1;
      setIndex(open ? (next + results.length) % results.length : 0);
      setOpen(true);
      requestAnimationFrame(() =>
        document
          .getElementById(`result-${open ? (next + results.length) % results.length : 0}`)
          ?.scrollIntoView({ block: 'nearest' }),
      );
    }
    if (event.key === 'Enter' && shown && results[current]) {
      event.preventDefault();
      choose(results[current].id);
    }
  }

  return (
    <div className="search">
      <div className="glass search-field">
        <span className="search-icon" aria-hidden="true" />
        <div className="search-input">
          <label htmlFor="spot-search">スポット検索</label>
          <input
            id="spot-search"
            type="search"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={shown}
            aria-controls={shown ? 'search-results' : undefined}
            aria-activedescendant={shown && results.length ? `result-${current}` : undefined}
            autoComplete="off"
            placeholder="名前・技術・タグ"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIndex(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={keydown}
          />
        </div>
        <kbd>/</kbd>
      </div>
      {shown && (
        <div className="glass search-list">
          <ul id="search-results" role="listbox" aria-label="スポット検索の結果">
            {results.map((node, row) => (
              <li
                id={`result-${row}`}
                role="option"
                aria-selected={row === current}
                key={node.id}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => choose(node.id)}
                onPointerMove={() => setIndex(row)}
              >
                <span>{node.name}</span>
                <small>
                  {kindLabel[node.kind]}
                  {node.technology && ` · ${node.technology}`}
                </small>
              </li>
            ))}
          </ul>
          {!results.length && <p role="status">該当する要素がありません。</p>}
        </div>
      )}
    </div>
  );
}
