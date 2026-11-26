import ELK, { type ElkExtendedEdge, type ElkNode } from 'elkjs/lib/elk.bundled.js';
import { ancestors } from '../model/graph.js';
import type { C4Workspace, ElementKind } from '../model/types.js';
import { graphBounds } from './bounds.js';
import { layoutPadding, type PositionedElement, type PositionedGraph, type Size } from './types.js';

const sizes: Record<ElementKind, Size> = {
  person: { width: 180, height: 110 },
  softwareSystem: { width: 280, height: 130 },
  container: { width: 220, height: 104 },
  component: { width: 180, height: 84 },
  element: { width: 220, height: 104 },
  group: { width: 180, height: 84 },
};

let elk: InstanceType<typeof ELK> | undefined;

export async function layoutWorkspace(workspace: C4Workspace): Promise<PositionedGraph> {
  const nodes: Record<string, PositionedElement> = Object.create(null);
  if (!workspace.rootIds.length) return { workspace, nodes, bounds: graphBounds([], nodes) };

  const ids = Object.keys(workspace.elements);
  const elkId = new Map(ids.map((id, index) => [id, `n${index}`]));
  const elementId = new Map(ids.map((id, index) => [`n${index}`, id]));
  const byId = new Map<string, ElkNode>();
  const layoutAnchors = new Map<string, string>();

  function inputNode(id: string): ElkNode {
    const element = workspace.elements[id]!;
    const node: ElkNode = { id: elkId.get(id)!, ...sizes[element.kind] };
    byId.set(id, node);
    if (element.childrenIds.length) {
      const { top, side } = layoutPadding;
      node.layoutOptions = {
        'elk.padding': `[top=${top},left=${side},bottom=${side},right=${side}]`,
        'elk.nodeSize.minimum': `(${node.width}, ${node.height})`,
        'elk.nodeSize.constraints': 'MINIMUM_SIZE',
      };
      node.children = element.childrenIds.map(inputNode);
      if (element.kind === 'container' && element.childrenIds.length >= 5) {
        const children = new Set(element.childrenIds);
        const allComponents = element.childrenIds.every(
          (id) => workspace.elements[id]?.kind === 'component',
        );
        const connected = workspace.relationships.some(
          ({ sourceId, targetId }) => children.has(sourceId) && children.has(targetId),
        );
        if (allComponents && !connected) {
          // コンポーネント間に関係がない場合は、親の中で矩形を詰めて縦一列を避ける。
          // 外部エッジの配置制約だけを親へ射影し、表示時の接続先は元のまま使う。
          Object.assign(node.layoutOptions, {
            'elk.hierarchyHandling': 'SEPARATE_CHILDREN',
            'elk.algorithm': 'rectpacking',
            'elk.aspectRatio': '1.4',
            'elk.spacing.nodeNode': '24',
          });
          for (const id of children) layoutAnchors.set(id, element.id);
        }
      }
    }
    return node;
  }

  const root: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '64',
      'elk.layered.spacing.nodeNodeBetweenLayers': '100',
      'elk.randomSeed': '1',
    },
    children: workspace.rootIds.map(inputNode),
  };

  const ancestry = new Map(ids.map((id) => [id, ancestors(workspace, id)]));
  const linked = new Set<string>();
  for (const edge of workspace.relationships) {
    const sourceId = layoutAnchors.get(edge.sourceId) ?? edge.sourceId;
    const targetId = layoutAnchors.get(edge.targetId) ?? edge.targetId;
    const sourcePath = ancestry.get(sourceId) ?? [];
    const targetPath = ancestry.get(targetId) ?? [];
    // 直接の親子間リンクは描画時に扱い、包含関係を ELK の配置制約と競合させない。
    if (sourceId === targetId || sourcePath.includes(targetId) || targetPath.includes(sourceId))
      continue;
    const source = elkId.get(sourceId);
    const target = elkId.get(targetId);
    const pair = `${source}>${target}`;
    if (!source || !target || linked.has(pair)) continue;
    linked.add(pair);
    const common = sourcePath.find((id) => targetPath.includes(id));
    const owner = (common && byId.get(common)) || root;
    const constraint: ElkExtendedEdge = {
      id: `e${linked.size}`,
      sources: [source],
      targets: [target],
    };
    (owner.edges ??= []).push(constraint);
  }

  elk ??= new ELK();
  const output = await elk.layout(root);
  function collect(node: ElkNode, x: number, y: number) {
    const id = elementId.get(node.id)!;
    const element = workspace.elements[id]!;
    const fallback = sizes[element.kind];
    const rect = {
      x: x + (node.x ?? 0),
      y: y + (node.y ?? 0),
      width: node.width ?? fallback.width,
      height: node.height ?? fallback.height,
    };
    nodes[id] = { ...rect, element };
    for (const child of node.children ?? []) collect(child, rect.x, rect.y);
  }

  for (const node of output.children ?? []) collect(node, 0, 0);
  return { workspace, nodes, bounds: graphBounds(workspace.rootIds, nodes) };
}
