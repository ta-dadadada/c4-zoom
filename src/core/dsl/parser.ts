import { lex, type Token } from './lexer';
import type {
  C4Element,
  C4Level,
  C4Relationship,
  C4Workspace,
  DslDiagnostic,
  ElementKind,
} from '../model/types';

interface DraftElement {
  kind: ElementKind;
  parent?: DraftElement;
  alias?: Token;
  name: string;
  values: Metadata;
  range: C4Element['sourceRange'];
  group?: string;
}

interface DraftRelationship {
  source: Token;
  target: Token;
  context?: DraftElement;
  values: Metadata;
  range: C4Relationship['sourceRange'];
}

type Metadata = Pick<C4Element, 'description' | 'technology' | 'url' | 'tags' | 'properties'>;
const metadata = (description?: string, technology?: string, tags?: string): Metadata => ({
  description: description || undefined,
  technology: technology || undefined,
  tags: splitTags([tags ?? '']),
  properties: Object.create(null) as Record<string, string>,
});
const splitTags = (values: string[]) =>
  values
    .flatMap((value) => value.split(','))
    .map((tag) => tag.trim())
    .filter(Boolean);
const keyword = (token: Token) => (token.kind === 'word' ? token.value.toLowerCase() : '');
const isValue = (token: Token) => token.kind === 'word' || token.kind === 'string';
const kinds: ReadonlyMap<string, ElementKind> = new Map([
  ['person', 'person'],
  ['softwaresystem', 'softwareSystem'],
  ['container', 'container'],
  ['component', 'component'],
  ['group', 'group'],
  ['element', 'element'],
]);
const unsupported = new Set([
  'views',
  'styles',
  'configuration',
  'deploymentenvironment',
  'deploymentnode',
  'infrastructurenode',
  'softwaresysteminstance',
  'containerinstance',
  'perspectives',
  'workspaceextends',
  'enterprise',
]);

class Parser {
  index = 0;
  name = 'Workspace';
  description?: string;
  hierarchical = false;
  readonly elements: DraftElement[] = [];
  readonly relationships: DraftRelationship[] = [];

  constructor(
    readonly tokens: Token[],
    readonly diagnostics: DslDiagnostic[],
  ) {}

  get token() {
    return this.tokens[this.index]!;
  }
  get next() {
    return this.tokens[this.index + 1];
  }

  take() {
    const token = this.token;
    if (token.kind !== 'eof') this.index++;
    return token;
  }

  is(kind: Token['kind']) {
    return this.token.kind === kind;
  }

  report(token: Token, message: string, severity: DslDiagnostic['severity'] = 'error') {
    this.diagnostics.push({ severity, message, ...token.start });
  }

  skipLines() {
    while (this.is('line')) this.take();
  }

  values(max = Infinity): Token[] {
    const values: Token[] = [];
    while (values.length < max && isValue(this.token)) {
      if (this.next?.kind === '=' || this.next?.kind === '->') break;
      values.push(this.take());
    }
    return values;
  }

  blockStart() {
    const index = this.index;
    this.skipLines();
    if (this.is('{')) return this.take();
    this.index = index;
    return undefined;
  }

  block(read: () => void) {
    this.skipLines();
    while (!this.is('}') && !this.is('eof')) {
      read();
      this.skipLines();
    }
    if (this.is('eof')) this.report(this.token, 'ブロックを閉じる } が必要です。');
    return this.take();
  }

  body() {
    this.skipLines();
    while (!this.is('eof')) {
      this.statement('root');
      this.skipLines();
    }
  }

  statement(scope: 'root' | 'workspace' | 'model' | 'element', parent?: DraftElement) {
    const start = this.take();
    let head = start;
    let alias: Token | undefined;
    if (head.kind === 'word' && this.is('=')) {
      alias = head;
      this.take();
      head = this.take();
    }
    const key = keyword(head);
    if (key === 'workspace' && scope === 'root' && !alias) {
      const [name, description] = this.values(2);
      this.name = name?.value || this.name;
      this.description = description?.value || undefined;
      if (this.blockStart()) this.block(() => this.statement('workspace'));
      else this.report(this.token, 'workspace に { が必要です。');
      return;
    }

    if (key === 'model' && (scope === 'root' || scope === 'workspace') && !alias) {
      if (this.blockStart()) this.block(() => this.statement('model'));
      else this.report(this.token, 'model に { が必要です。');
      return;
    }

    if (key === '!identifiers') {
      const values = this.values();
      const mode = values[0] && keyword(values[0]);
      if (mode === 'hierarchical' || mode === 'flat') this.hierarchical = mode === 'hierarchical';
      else this.report(head, '!identifiers の形式を読み飛ばしました。', 'info');
      return;
    }

    if (head.kind === '->' || (head.kind === 'word' && this.is('->'))) {
      this.relationship(start, head, parent);
      return;
    }

    const kind = kinds.get(key);
    if (kind && scope !== 'workspace') {
      this.element(start, kind, alias, parent);
      return;
    }

    if (parent && !alias && this.readMetadata(key, parent.values, head)) return;
    if (key === 'properties' && !alias) {
      this.readMetadata(key, metadata(), head);
      return;
    }

    if (unsupported.has(key) || key.startsWith('!')) {
      this.skipUnsupported(head);
      return;
    }

    this.report(head, `認識できない構文です: ${head.value || '入力末尾'}`);
    this.values();
    if (this.blockStart()) this.skipBlock();
  }

  element(start: Token, kind: ElementKind, alias?: Token, parent?: DraftElement) {
    const internal = kind === 'container' || kind === 'component';
    const args = this.values(kind === 'group' ? 1 : internal || kind === 'element' ? 4 : 3);
    if (args[0] === undefined || !args[0].value.trim()) {
      this.report(this.token, '要素名が必要です。');
      if (this.blockStart()) this.skipBlock();
      return;
    }

    const [name, description, technologyOrTags, tags] = args;
    const opening = this.blockStart();
    if (kind === 'group' && !opening && parent && parent.kind !== 'group' && !alias) {
      parent.group = name.value;
      return;
    }

    let owner = parent;
    while (owner?.kind === 'group') owner = owner.parent;
    const expected =
      kind === 'container' ? 'softwareSystem' : kind === 'component' ? 'container' : undefined;
    if (kind !== 'group' && (expected ? owner?.kind !== expected : owner !== undefined)) {
      this.report(start, `${kind} をこの階層に配置できません。`);
    }

    const hasTechnology = internal || kind === 'element';
    const element: DraftElement = {
      kind,
      parent,
      alias,
      name: name.value,
      values: metadata(
        description?.value,
        hasTechnology ? technologyOrTags?.value : undefined,
        hasTechnology ? tags?.value : technologyOrTags?.value,
      ),
      range: { start: start.start, end: args.at(-1)!.end },
    };
    this.elements.push(element);
    if (opening) {
      const end = this.block(() => this.statement('element', element));
      element.range = { start: start.start, end: end.end };
    }
  }

  relationship(start: Token, head: Token, context?: DraftElement) {
    const implicit = head.kind === '->';
    const source = implicit ? { ...head, kind: 'word' as const, value: 'this' } : head;
    if (!implicit) this.take();
    const target = this.token;
    if (target.kind !== 'word') {
      this.report(target, '関係の接続先識別子が必要です。');
      return;
    }
    this.take();
    const [description, technology, tags] = this.values(3);
    const values = metadata(description?.value, technology?.value, tags?.value);
    let end = this.tokens[this.index - 1]!.end;
    if (this.blockStart()) {
      end = this.block(() => {
        const field = this.take();
        if (!this.readMetadata(keyword(field), values, field)) this.skipUnsupported(field);
      }).end;
    }
    this.relationships.push({
      source,
      target,
      context,
      values,
      range: { start: start.start, end },
    });
  }

  readMetadata(key: string, values: Metadata, token: Token): boolean {
    switch (key) {
      case 'description':
      case 'technology':
      case 'url': {
        const [value] = this.values(1);
        if (value) values[key] = value.value;
        else this.report(this.token, `${key} の値が必要です。`);
        return true;
      }
      case 'tag':
      case 'tags': {
        const tags = this.values();
        if (!tags.length) this.report(this.token, 'タグ名が必要です。');
        values.tags.push(...splitTags(tags.map((value) => value.value)));
        return true;
      }
      case 'properties':
        if (this.blockStart()) {
          this.block(() => {
            const name = this.take();
            const [value] = this.values(1);
            if (isValue(name) && value) values.properties[name.value] = value.value;
            else this.report(name, 'プロパティには名前と値が必要です。');
          });
        } else this.report(token, 'properties に { が必要です。');
        return true;
      default:
        return false;
    }
  }

  skipUnsupported(token: Token) {
    this.report(token, `未対応の構文を読み飛ばしました: ${token.value}`, 'info');
    while (!this.is('eof') && !this.is('line') && !this.is('{') && !this.is('}')) this.take();
    if (this.blockStart()) this.skipBlock();
  }

  skipBlock() {
    let depth = 1;
    while (depth && !this.is('eof')) {
      const token = this.take();
      if (token.kind === '{') depth++;
      if (token.kind === '}') depth--;
    }
    if (depth) this.report(this.token, '読み飛ばしたブロックを閉じる } が必要です。');
  }
}

function slug(name: string) {
  return (
    name
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}_-]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'element'
  );
}

function compile(parser: Parser): C4Workspace {
  const workspace: C4Workspace = {
    name: parser.name,
    description: parser.description,
    elements: Object.create(null) as Record<string, C4Element>,
    rootIds: [],
    relationships: [],
  };
  const nodeByDraft = new Map<DraftElement, C4Element>();
  const qualified = new Map<string, C4Element>();
  const aliases = new Map<string, Set<C4Element>>();
  const declared = new Set<string>();
  const logicalPaths = new Map<DraftElement, string>();
  const groupParents = new Map<DraftElement, DraftElement>();
  const membershipGroups = new Map<DraftElement | undefined, Map<string, DraftElement>>();

  for (const draft of parser.elements) {
    if (draft.kind !== 'group') continue;
    const byName = membershipGroups.get(draft.parent) ?? new Map();
    membershipGroups.set(draft.parent, byName);
    if (!byName.has(draft.name)) byName.set(draft.name, draft);
  }

  for (const draft of parser.elements.filter((element) => element.group !== undefined)) {
    if (draft.group === undefined) continue;
    const byName = membershipGroups.get(draft.parent) ?? new Map<string, DraftElement>();
    membershipGroups.set(draft.parent, byName);
    let group = byName.get(draft.group);
    if (!group) {
      group = {
        kind: 'group',
        name: draft.group,
        parent: draft.parent,
        values: metadata(),
        range: draft.range,
      };
      parser.elements.push(group);
      byName.set(draft.group, group);
    }
    groupParents.set(draft, group);
  }

  function position(draft: DraftElement): C4Element {
    const existing = nodeByDraft.get(draft);
    if (existing) return existing;
    const containing = groupParents.get(draft) ?? draft.parent;
    const parent = containing && position(containing);
    let owner = draft.parent;
    while (owner?.kind === 'group') owner = owner.parent;
    const ownerPath = owner && logicalPaths.get(owner);
    const localId = draft.alias?.value ?? slug(draft.name);
    const baseId =
      draft.kind === 'group'
        ? `${parent ? parent.id + '/' : ''}@${localId}`
        : ownerPath
          ? `${ownerPath}.${localId}`
          : localId;
    let id = baseId;
    for (let n = 2; workspace.elements[id]; n++) id = `${baseId}~${n}`;
    const alias = draft.alias;
    if (alias) {
      const symbol = parser.hierarchical ? baseId : alias.value;
      if (declared.has(symbol))
        parser.report(alias, `識別子が重複しています: ${symbol}`, 'warning');
      declared.add(symbol);
    }
    logicalPaths.set(draft, id);
    const level: C4Level =
      draft.kind === 'component'
        ? 3
        : draft.kind === 'container'
          ? 2
          : draft.kind === 'group' && owner?.kind === 'container'
            ? 3
            : draft.kind === 'group' && owner?.kind === 'softwareSystem'
              ? 2
              : 1;
    const node: C4Element = {
      id,
      alias: alias?.value,
      name: draft.name,
      kind: draft.kind,
      level,
      ...draft.values,
      tags: [...new Set(draft.values.tags)],
      parentId: parent?.id ?? null,
      childrenIds: [],
      sourceRange: draft.range,
    };
    nodeByDraft.set(draft, node);
    workspace.elements[id] = node;
    (parent?.childrenIds ?? workspace.rootIds).push(id);
    qualified.set(id, node);
    if (alias) {
      const matches = aliases.get(alias.value) ?? new Set();
      matches.add(node);
      aliases.set(alias.value, matches);
    }
    return node;
  }

  parser.elements.forEach(position);

  function resolve(token: Token, context?: DraftElement): C4Element | undefined {
    if (keyword(token) === 'this') {
      while (context?.kind === 'group') context = context.parent;
      if (context) return nodeByDraft.get(context);
      parser.report(token, 'this は要素のブロック内で使用してください。', 'error');
      return;
    }
    if (parser.hierarchical) {
      for (let scope = context; scope; scope = scope.parent) {
        const found = qualified.get(`${logicalPaths.get(scope)}.${token.value}`);
        if (found) return found;
      }
    }
    const matches = aliases.get(token.value);
    const match =
      !parser.hierarchical && matches
        ? matches.values().next().value
        : (qualified.get(token.value) ??
          (matches?.size === 1 ? matches.values().next().value : undefined));
    if (!match) parser.report(token, `識別子を解決できません: ${token.value}`, 'warning');
    return match;
  }

  for (const edge of parser.relationships) {
    const source = resolve(edge.source, edge.context);
    const target = resolve(edge.target, edge.context);
    if (!source || !target) continue;
    workspace.relationships.push({
      id: `r${workspace.relationships.length + 1}`,
      sourceId: source.id,
      targetId: target.id,
      ...edge.values,
      tags: [...new Set(edge.values.tags)],
      sourceRange: edge.range,
    });
  }
  return workspace;
}

export function parseDsl(text: string): {
  workspace: C4Workspace | null;
  diagnostics: DslDiagnostic[];
} {
  const { tokens, diagnostics } = lex(text);
  const parser = new Parser(tokens, diagnostics);
  parser.body();
  const workspace = compile(parser);
  diagnostics.sort((a, b) => a.line - b.line || a.column - b.column);
  return {
    workspace: diagnostics.some((diagnostic) => diagnostic.severity === 'error') ? null : workspace,
    diagnostics,
  };
}
