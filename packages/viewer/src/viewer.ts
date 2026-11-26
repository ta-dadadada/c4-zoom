import type { C4ZoomBootstrapPayload } from '@c4-zoom/core/export';

export interface Sample {
  id: string;
  name: string;
  text: string;
  license?: string;
}

export type Viewer =
  | {
      mode: 'sample-site';
      samples: readonly Sample[];
      repositoryUrl?: string;
      createWorker(): Worker;
    }
  | { mode: 'standalone'; payload?: C4ZoomBootstrapPayload };
