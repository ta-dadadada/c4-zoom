import type { C4Element, C4Workspace } from '../model/types';

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Point, Size {}

export interface PositionedElement extends Rect {
  element: C4Element;
}

export interface PositionedGraph {
  workspace: C4Workspace;
  nodes: Record<string, PositionedElement>;
  bounds: Rect;
}

export interface Offset {
  dx: number;
  dy: number;
}

export type Offsets = Record<string, Offset>;

export interface LayoutOverrides {
  workspaceHash: string;
  offsets: Offsets;
}

export const layoutPadding = { top: 66, side: 24 };
