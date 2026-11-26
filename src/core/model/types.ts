export type ElementKind =
  | 'person'
  | 'softwareSystem'
  | 'container'
  | 'component'
  | 'group'
  | 'element';
export type C4Level = 1 | 2 | 3;

export interface SourcePosition {
  line: number;
  column: number;
}

export interface SourceRange {
  start: SourcePosition;
  end: SourcePosition;
}

export interface C4Element {
  id: string;
  alias?: string;
  kind: ElementKind;
  level: C4Level;
  name: string;
  description?: string;
  technology?: string;
  url?: string;
  tags: string[];
  properties: Record<string, string>;
  parentId: string | null;
  childrenIds: string[];
  sourceRange?: SourceRange;
}

export interface C4Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  description?: string;
  technology?: string;
  url?: string;
  tags: string[];
  properties: Record<string, string>;
  sourceRange?: SourceRange;
}

export interface C4Workspace {
  name: string;
  description?: string;
  elements: Record<string, C4Element>;
  rootIds: string[];
  relationships: C4Relationship[];
}

export interface DslDiagnostic extends SourcePosition {
  severity: 'error' | 'warning' | 'info';
  message: string;
}
