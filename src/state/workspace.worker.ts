import { parseDsl } from '../core/dsl/parser';
import { layoutWorkspace } from '../core/layout/elkLayout';
import type { PositionedGraph } from '../core/layout/types';
import type { DslDiagnostic } from '../core/model/types';

export interface LayoutRequest {
  text: string;
}

export interface LayoutResponse {
  graph: PositionedGraph | null;
  diagnostics: DslDiagnostic[];
}

self.onmessage = async ({ data }: MessageEvent<LayoutRequest>) => {
  let response: LayoutResponse;
  try {
    const { workspace, diagnostics } = parseDsl(data.text);
    response = { graph: workspace ? await layoutWorkspace(workspace) : null, diagnostics };
  } catch {
    response = {
      graph: null,
      diagnostics: [
        { severity: 'error', message: 'DSL から地図を生成できませんでした。', line: 1, column: 1 },
      ],
    };
  }
  self.postMessage(response);
};
