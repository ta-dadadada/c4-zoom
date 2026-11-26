import { bootstrapId, type C4ZoomBootstrapPayload } from '@c4-zoom/core/export';

export function readBootstrap(doc: Document): C4ZoomBootstrapPayload | undefined {
  const text = doc.getElementById(bootstrapId)?.textContent;
  if (!text) return;
  try {
    const payload: unknown = JSON.parse(text);
    if (
      payload &&
      typeof payload === 'object' &&
      'schemaVersion' in payload &&
      payload.schemaVersion === 1 &&
      'mode' in payload &&
      payload.mode === 'standalone' &&
      'workspace' in payload &&
      payload.workspace &&
      typeof payload.workspace === 'object' &&
      'name' in payload.workspace &&
      typeof payload.workspace.name === 'string' &&
      'rootIds' in payload.workspace &&
      Array.isArray(payload.workspace.rootIds)
    ) {
      return payload as C4ZoomBootstrapPayload;
    }
  } catch {
    return undefined;
  }
}
