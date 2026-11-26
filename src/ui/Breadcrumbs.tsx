import { useAppState, useCanvasRuntime, useHud } from '../state/AppStateContext';
import { fitMap, focusNode } from '../state/runtime';

export function Breadcrumbs() {
  const { active } = useAppState();
  const { path } = useHud();
  const runtime = useCanvasRuntime();
  const workspace = active?.graph.workspace;
  if (!workspace) return null;
  const crumbs = path.filter(
    (id, index) => index > 0 || workspace.elements[id]?.name !== workspace.name,
  );

  return (
    <nav className="glass breadcrumbs" aria-label="地図の現在地">
      <ol>
        <li>
          <button
            className="crumb-root"
            type="button"
            onClick={() => fitMap(runtime)}
            aria-current={!crumbs.length && path.length ? 'location' : undefined}
            aria-label={`${workspace.name} の全体表示`}
            title={`${workspace.name} の全体表示`}
          >
            <span aria-hidden="true" className="workspace-icon">
              ◇
            </span>
            {workspace.name}
          </button>
        </li>
        {crumbs.map((id, index) => {
          const node = workspace.elements[id];
          return (
            node && (
              <li key={id}>
                <span aria-hidden="true" className="crumb-divider">
                  ›
                </span>
                <button
                  type="button"
                  onClick={() => focusNode(runtime, id)}
                  title={node.name}
                  aria-current={index === crumbs.length - 1 ? 'location' : undefined}
                >
                  {node.name}
                </button>
              </li>
            )
          );
        })}
      </ol>
    </nav>
  );
}
