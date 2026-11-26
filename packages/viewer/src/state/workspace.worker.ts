import { computeLayout } from './layoutRunner';

self.onmessage = async ({ data }: MessageEvent<string>) => {
  self.postMessage(await computeLayout(data));
};
