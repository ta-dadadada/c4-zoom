import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parseStructurizrWorkspaceJson } from '../json/index.js';
import { center } from '../layout/bounds.js';
import { layoutWorkspace } from '../layout/elkLayout.js';
import type { PositionedGraph } from '../layout/types.js';
import { createEdgeRollup, rollupEdges } from './edgeRollup.js';
import { activeLocation, detailAlpha, evaluateLod } from './lod.js';

async function layout(path: string) {
  return layoutWorkspace(
    parseStructurizrWorkspaceJson(
      readFileSync(new URL('../../../../fixtures/json/' + path, import.meta.url), 'utf8'),
    ).workspace!,
  );
}

function byDslIdentifier(graph: PositionedGraph, identifier: string) {
  return Object.values(graph.nodes).find(
    ({ element }) => element.properties['structurizr.dsl.identifier'] === identifier,
  )!;
}

it('keeps the expansion curve continuous and bounded', () => {
  expect([100, 140, 170, 200, 230, 260, 300].map((size) => detailAlpha(1000, size, 1))).toEqual([
    0, 0, 0.15625, 0.5, 0.84375, 1, 1,
  ]);
});

it('merges Big Bank direct and projected edges without elevating a group to a C4 anchor', async () => {
  const graph = await layout('upstream/big-bank-plc.json');
  const rollup = createEdgeRollup(graph.workspace);
  const edges = rollup(evaluateLod(graph, 0.04));
  const customer = byDslIdentifier(graph, 'customer').element.id;
  const system = byDslIdentifier(graph, 'internetBankingSystem').element.id;
  expect(rollup(evaluateLod(graph, 0.05))).toBe(edges);
  expect(
    edges.find((edge) => edge.sourceId === customer && edge.targetId === system),
  ).toMatchObject({
    count: 4,
    technologies: ['HTTPS'],
    summaryLabel: 'Views account balances, and makes payments using',
  });
  expect(edges.every((edge) => edge.sourceId !== edge.targetId)).toBe(true);
});

it('projects mixed detail across neighboring systems and identifies the component at the camera center', async () => {
  const graph = await layout('custom/cloudshop-multi-system.json');
  const source = byDslIdentifier(graph, 'commerce.orderApi.checkoutService').element.id;
  const target = byDslIdentifier(graph, 'fulfillment.inventoryApi.reservationHandler').element.id;
  const from = byDslIdentifier(graph, 'commerce.orderApi');
  const to = byDslIdentifier(graph, 'fulfillment.inventoryApi');
  const zoom = 200 / Math.sqrt(Math.min(from.width, from.height) * Math.min(to.width, to.height));
  const visibility = evaluateLod(graph, zoom);
  const sourceAnchor = visibility.get(source)?.anchorId;
  const targetAnchor = visibility.get(target)?.anchorId;
  expect([sourceAnchor === source, targetAnchor === target].sort()).toEqual([false, true]);
  expect(rollupEdges(graph.workspace, visibility)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        sourceId: sourceAnchor,
        targetId: targetAnchor,
        technologies: ['gRPC'],
      }),
    ]),
  );
  const camera = { ...center(graph.nodes[source]!), zoom: 4 };
  expect(
    activeLocation(graph, evaluateLod(graph, camera.zoom), camera, { width: 900, height: 720 }),
  ).toMatchObject({
    level: 3,
    path: [byDslIdentifier(graph, 'commerce').element.id, from.element.id, source],
  });
});

it('keeps both directions distinct for NovaBank', async () => {
  const graph = await layout('custom/novabank-event-driven.json');
  const edges = rollupEdges(graph.workspace, evaluateLod(graph, 0.04));
  const ledger = byDslIdentifier(graph, 'ledger').element.id;
  const clearing = byDslIdentifier(graph, 'clearingNetwork').element.id;
  expect(
    edges.find((edge) => edge.sourceId === ledger && edge.targetId === clearing)?.bidirectional,
  ).toBe(true);
  expect(
    edges.find((edge) => edge.sourceId === clearing && edge.targetId === ledger)?.bidirectional,
  ).toBe(true);
});

it('suppresses only refined Big Bank directions once the system is expanded', async () => {
  const graph = await layout('upstream/big-bank-plc.json');
  const system = byDslIdentifier(graph, 'internetBankingSystem').element.id;
  const customer = byDslIdentifier(graph, 'customer').element.id;
  const email = byDslIdentifier(graph, 'email').element.id;
  const mainframe = byDslIdentifier(graph, 'mainframe').element.id;
  const web = byDslIdentifier(graph, 'webApplication').element.id;
  const visible = evaluateLod(graph, 2);
  const edges = createEdgeRollup(graph.workspace)(visible);
  for (const [source, target] of [
    [customer, system],
    [system, email],
    [system, mainframe],
  ]) {
    expect(edges.some((edge) => edge.sourceId === source && edge.targetId === target)).toBe(false);
  }
  expect(edges.some((edge) => edge.sourceId === customer && edge.targetId === web)).toBe(true);
  expect(edges.some((edge) => edge.sourceId === email && edge.targetId === customer)).toBe(true);
});

it('opens a parent at its framed scale while preserving a calm overview and the dominant level across a gap', async () => {
  const graph = await layout('upstream/big-bank-plc.json');
  const viewport = { width: 1440, height: 900 };
  const system = byDslIdentifier(graph, 'internetBankingSystem');
  const container = byDslIdentifier(graph, 'apiApplication');
  const overviewZoom = 0.65;
  const overview = evaluateLod(graph, overviewZoom, overviewZoom);
  expect(overview.get(system.element.id)?.detail).toBe(0);
  expect(
    activeLocation(graph, overview, { ...center(graph.bounds), zoom: overviewZoom }, viewport)
      .level,
  ).toBe(1);
  const zoom = 0.66;
  const detail = evaluateLod(graph, zoom, overviewZoom, {
    zoom,
    expanded: new Set([system.element.id, container.element.id]),
    collapsed: new Set(),
  });
  const camera = { ...center(container), zoom };
  expect(
    activeLocation(graph, detail, camera, viewport, { x: 420, y: 200, width: 600, height: 500 })
      .level,
  ).toBe(3);
});
