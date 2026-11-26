import { readdirSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { maxWorkspaceJsonBytes, parseStructurizrWorkspaceJson } from './workspace.js';

const repo = new URL('../../../../', import.meta.url);
const fixtures = ['upstream', 'custom'].flatMap((group) =>
  readdirSync(new URL(`fixtures/json/${group}/`, repo))
    .filter((name) => name.endsWith('.json'))
    .map((name) => `fixtures/json/${group}/${name}`),
);
const invalid = ['fixtures/json/custom/invalid.json', 'fixtures/json/custom/missing-model.json'];
const valid = [
  'docs/architecture/workspace.json',
  ...fixtures.filter((path) => !invalid.includes(path)),
];

it.each(valid)('normalizes the official fixture %s into a rooted graph', (path) => {
  const input = readFileSync(new URL(path, repo), 'utf8');
  const { workspace, diagnostics } = parseStructurizrWorkspaceJson(input);
  expect(diagnostics.filter(({ severity }) => severity !== 'info')).toEqual([]);
  expect(workspace!.rootIds.length).toBeGreaterThan(0);
  const visited = new Set<string>();
  function visit(id: string, parentId: string | null) {
    expect(visited.has(id)).toBe(false);
    visited.add(id);
    const element = workspace!.elements[id]!;
    expect(element.parentId).toBe(parentId);
    for (const child of element.childrenIds) visit(child, id);
  }
  for (const root of workspace!.rootIds) visit(root, null);
  expect(visited.size).toBe(Object.keys(workspace!.elements).length);
  for (const edge of workspace!.relationships) {
    expect(visited.has(edge.sourceId)).toBe(true);
    expect(visited.has(edge.targetId)).toBe(true);
  }
});

it.each(invalid)('returns an error and no replacement model for %s', (path) => {
  const result = parseStructurizrWorkspaceJson(readFileSync(new URL(path, repo), 'utf8'));
  expect(result.workspace).toBeUndefined();
  expect(result.diagnostics).toEqual([expect.objectContaining({ severity: 'error' })]);
});

it('reconstructs the official nested groups at all three C4 levels', () => {
  const { workspace } = parseStructurizrWorkspaceJson(
    readFileSync(new URL('fixtures/json/upstream/groups-nested.json', repo), 'utf8'),
  );
  const element = (name: string) =>
    Object.values(workspace!.elements).find((candidate) => candidate.name === name)!;
  expect(element('Organisation')).toMatchObject({ kind: 'group', level: 1, parentId: null });
  expect(element('Department A')).toMatchObject({ parentId: element('Organisation').id });
  expect(element('A')).toMatchObject({ id: '1', parentId: element('Department A').id });
  expect(element('Capability 1')).toMatchObject({ level: 2, parentId: '1' });
  expect(element('A API')).toMatchObject({ id: '2', parentId: element('Service A').id });
  expect(element('a-api.jar')).toMatchObject({ level: 3, parentId: '2' });
  expect(element('API Endpoint')).toMatchObject({ id: '3', parentId: element('API Layer').id });
});

it('keeps identically named groups separate across scopes and supports a custom separator', () => {
  const { workspace } = parseStructurizrWorkspaceJson({
    model: {
      properties: { 'structurizr.groupSeparator': '::' },
      people: [{ id: 'group:[null,"Org"]', name: 'Group ID collision' }],
      softwareSystems: [
        {
          id: 's1',
          name: 'First',
          group: 'Org::Team',
          containers: [{ id: 'c1', name: 'C1', group: 'Team' }],
        },
        {
          id: 's2',
          name: 'Second',
          group: 'Org::Team',
          containers: [{ id: 'c2', name: 'C2', group: 'Team' }],
        },
      ],
    },
  });
  const { elements } = workspace!;
  expect(elements['group:[null,"Org"]']?.kind).toBe('person');
  expect(elements.s1?.parentId).toBe(elements.s2?.parentId);
  expect(elements.c1?.parentId).not.toBe(elements.c2?.parentId);
  expect(elements[elements.c1!.parentId!]).toMatchObject({
    kind: 'group',
    level: 2,
    parentId: 's1',
  });
  expect(elements[elements.c2!.parentId!]).toMatchObject({
    kind: 'group',
    level: 2,
    parentId: 's2',
  });
});

it('maps official metadata, deduplicates relationship IDs, and ignores deployment targets', () => {
  const relationship = {
    id: 'valid',
    sourceId: '1',
    destinationId: '3',
    url: 'https://example.com/edge',
    technology: 'HTTP',
    tags: '  A, , B, A',
  };
  const { workspace, diagnostics } = parseStructurizrWorkspaceJson({
    name: ' Workspace ',
    description: 'Description',
    model: {
      people: [
        {
          id: '1',
          name: 'Person',
          relationships: [
            { ...relationship, id: 'deployment', destinationId: 'deploy' },
            relationship,
          ],
        },
      ],
      softwareSystems: [
        {
          id: '2',
          name: 'System',
          location: 'External',
          tags: ' A ,A',
          url: 'https://example.com/system',
        },
      ],
      customElements: [{ id: '3', name: 'Custom', relationships: [relationship] }],
      deploymentNodes: [{ id: 'deploy', name: 'Deployment' }],
    },
    views: { containerViews: [] },
  });
  expect(workspace).toMatchObject({
    name: ' Workspace ',
    description: 'Description',
    elements: {
      '1': { kind: 'person', level: 1 },
      '2': {
        kind: 'softwareSystem',
        level: 1,
        tags: ['A', 'External'],
        url: 'https://example.com/system',
      },
      '3': { kind: 'element', level: 1 },
    },
    relationships: [
      {
        id: 'valid',
        sourceId: '1',
        targetId: '3',
        technology: 'HTTP',
        url: 'https://example.com/edge',
        tags: ['A', 'B'],
      },
    ],
  });
  expect(Object.hasOwn(workspace!.elements, 'deploy')).toBe(false);
  expect(diagnostics).toEqual([
    expect.objectContaining({ severity: 'info', path: 'model.people[0].relationships[0]' }),
  ]);
});

it('preserves official IDs while ignoring unsafe property keys on elements and relationships', () => {
  const properties =
    '{"__proto__":"ignore","constructor":"ignore","prototype":"ignore","keep":"yes","object":{"unused":true}}';
  const { workspace } = parseStructurizrWorkspaceJson(`{
    "model": {
      "people": [{"id":"__proto__","name":"Person","properties":${properties},
      "relationships":[{"id":"edge","sourceId":"__proto__","destinationId":"constructor","properties":${properties}}]}],
      "softwareSystems": [{"id":"constructor","name":"System"}]
    }
  }`);
  expect(Object.getPrototypeOf(workspace!.elements)).toBeNull();
  for (const result of [
    workspace!.elements['__proto__']!.properties,
    workspace!.relationships[0]!.properties,
  ]) {
    expect(Object.getPrototypeOf(result)).toBeNull();
    expect(Object.entries(result)).toEqual([['keep', 'yes']]);
  }
});

it('warns about duplicate IDs and missing names without introducing cycles', () => {
  const { workspace, diagnostics } = parseStructurizrWorkspaceJson({
    model: {
      softwareSystems: [
        {
          id: 's',
          containers: [
            { id: 's', name: 'Duplicate' },
            { id: 'c', name: 'Child', parentId: 'c' },
          ],
        },
      ],
    },
  });
  expect(workspace!.rootIds).toEqual(['s']);
  expect(workspace!.elements.s).toMatchObject({ name: 's', childrenIds: ['c'] });
  expect(workspace!.elements.c).toMatchObject({ parentId: 's' });
  expect(diagnostics.map(({ severity }) => severity)).toEqual(['warning', 'warning']);
});

it('accepts a UTF-8 BOM and rejects an unsafe group depth', () => {
  expect(parseStructurizrWorkspaceJson('\uFEFF{"model":{}}').workspace?.name).toBe(
    'Untitled Workspace',
  );
  const result = parseStructurizrWorkspaceJson({
    model: { people: [{ id: '1', name: 'Person', group: 'Group/'.repeat(33) }] },
  });
  expect(result.workspace).toBeUndefined();
  expect(result.diagnostics).toEqual([expect.objectContaining({ severity: 'error' })]);
});

it('rejects JSON past the byte limit', () => {
  const oversized = parseStructurizrWorkspaceJson(' '.repeat(maxWorkspaceJsonBytes + 1));
  expect(oversized.workspace).toBeUndefined();
  expect(oversized.diagnostics).toEqual([expect.objectContaining({ severity: 'error' })]);
});

it('omits raw DSL workspace metadata from the normalized model', () => {
  const result = parseStructurizrWorkspaceJson({
    properties: { 'structurizr.dsl': 'embedded DSL source' },
    model: { people: [{ id: '1', name: 'Person' }] },
  });
  expect(JSON.stringify(result.workspace)).not.toContain('embedded DSL source');
});
