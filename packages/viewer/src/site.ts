import { mount } from './mount';
import { samples } from './samples';

mount({
  mode: 'sample-site',
  samples,
  repositoryUrl: 'https://github.com/ta-dadadada/c4-zoom',
  createWorker: () =>
    new Worker(new URL('./state/workspace.worker.ts', import.meta.url), {
      type: 'module',
    }),
});
