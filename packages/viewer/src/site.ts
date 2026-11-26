import { mount } from './mount';
import { samples } from './samples';

mount({
  mode: 'sample-site',
  samples,
  createWorker: () =>
    new Worker(new URL('./state/workspace.worker.ts', import.meta.url), {
      type: 'module',
    }),
});
