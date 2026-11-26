import { expect, it } from 'vitest';
import type { C4Workspace } from '../model/types.js';
import {
  injectBootstrap,
  parseLayoutOverrides,
  serializeBootstrap,
  workspaceHash,
  type C4ZoomBootstrapPayload,
} from './index.js';

const template = `<!doctype html><title>Viewer</title>
<script id="c4-zoom-bootstrap" type="application/json"></script><div id="root"></div>`;

const workspace: C4Workspace = {
  name: 'Map',
  elements: {
    sys: {
      id: 'sys',
      level: 1,
      kind: 'softwareSystem',
      name: 'System',
      parentId: null,
      childrenIds: [],
      tags: [],
      properties: {},
    },
  },
  rootIds: ['sys'],
  relationships: [],
};

const payload: C4ZoomBootstrapPayload = { schemaVersion: 1, mode: 'standalone', workspace };

it('preserves hostile-looking script text as JSON data and escapes the title', () => {
  const description = '</script><script type="application/json">"marker"</script>&<>\u2028\u2029';
  const data = {
    ...payload,
    title: `<"Map"> & 'title' $&`,
    workspace: { ...workspace, description },
  };
  const json = serializeBootstrap(data);
  const html = injectBootstrap(template, data);

  expect(json).not.toMatch(/[<>&\u2028\u2029]/);
  expect(JSON.parse(json)).toEqual(data);
  expect(html).toContain('<title>&lt;&quot;Map&quot;&gt; &amp; &#39;title&#39; $&amp;</title>');
  expect(html.match(/<script\b/g)).toHaveLength(1);
  expect(html).toContain(`type="application/json">${json}</script>`);
});

it('replaces an existing bootstrap without modifying the surrounding document', () => {
  const html = injectBootstrap(template, { ...payload, title: 'Before' });
  const replaced = injectBootstrap(html, { ...payload, title: 'After' });
  expect(replaced).toBe(injectBootstrap(template, { ...payload, title: 'After' }));
  expect(() => injectBootstrap('<title>Viewer</title>', payload)).toThrow('c4-zoom-bootstrap');
});

it('validates an offsets map and binds it to the current workspace', () => {
  const offsets = { sys: { dx: 19.5, dy: -8 } };
  const hash = workspaceHash(workspace);
  const result = parseLayoutOverrides(offsets, workspace);
  expect(result).toEqual({ workspaceHash: hash, offsets });
  expect(workspaceHash(JSON.parse(JSON.stringify(workspace)))).toBe(hash);
  expect(parseLayoutOverrides(result, workspace)).toEqual(result);
  expect(() => parseLayoutOverrides(result, { ...workspace, name: 'Changed' })).toThrow(
    'workspaceHash',
  );
  expect(() => parseLayoutOverrides({ sys: { dx: Infinity, dy: 0 } }, workspace)).toThrow('dx');
  expect(() =>
    parseLayoutOverrides(JSON.parse('{"__proto__":{"dx":10,"dy":0}}'), workspace),
  ).toThrow('__proto__');
});
