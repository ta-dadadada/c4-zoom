import { parseStructurizrWorkspaceJson, type WorkspaceDiagnostic } from '@c4-zoom/core/json';
import type { PositionedGraph } from '@c4-zoom/core/layout/types';
import type { C4Workspace } from '@c4-zoom/core/model/types';
import { loadDiagnostic } from './source';

export interface LayoutResponse {
  graph: PositionedGraph | null;
  diagnostics: WorkspaceDiagnostic[];
}

export async function computeLayout(input: string | C4Workspace): Promise<LayoutResponse> {
  const { workspace, diagnostics } =
    typeof input === 'string'
      ? parseStructurizrWorkspaceJson(input)
      : { workspace: input, diagnostics: [] };
  if (!workspace) return { graph: null, diagnostics };

  try {
    const { layoutWorkspace } = await import('@c4-zoom/core/layout/elkLayout');
    return { graph: await layoutWorkspace(workspace), diagnostics };
  } catch {
    return {
      graph: null,
      diagnostics: [...diagnostics, loadDiagnostic('JSON から地図を生成できませんでした。')],
    };
  }
}
