# 0006: React Context + useReducer と高頻度 Canvas 状態の Ref 隔離

- **Status**: Accepted
- **Date**: 2026-11-26

## Context

c4-zoom は「60fps で毎フレーム更新される HTML5 Canvas 2D 地図（カメラ座標・ズーム倍率・慣性速度・Fly-to 補間・ホバー状態）」と、「低頻度に更新される React フローティング UI（検索バー・パンくず・ズーム計・インスペクタ・選択状態・診断表示）」の二層で構成される（[ADR 0003](./0003-custom-canvas-2d-renderer-and-core-separation.md)）。

カメラ座標やホバー状態をそのまま React の state に載せると、ホイールやドラッグのたびに UI ツリー全体が再レンダリングされ、60fps の滑らかな操作感を損なう。一方で、状態管理のためだけに外部ライブラリを導入するか、React 標準機能で境界を設計するかを決める必要がある。

## Decision

**外部状態管理ライブラリを導入せず、「React Context + `useReducer`（低頻度 UI 状態）」と「mutable `Ref` ブリッジ（高頻度 Canvas 状態）」の二層分離を採用する。**

1. **低頻度 UI 状態（`Context + useReducer`）**:
   - 読み込み済みモデル（Last-Known-Good）、診断結果、選択ノード／エッジ、トレースモード（`1-hop` / `transitive`）、レイアウト編集モード、手動オフセット、テーマ等を管理する。
   - 不要な再レンダリングを防ぐため、State Context と Dispatch / RuntimeRef Context を分離する。
2. **高頻度ランタイム状態（`Canvas Runtime Ref Bridge`）**:
   - カメラ位置・ズーム・慣性・Fly-to アニメーション状態・カーソルホバー対象は mutable `Ref` に隔離し、`requestAnimationFrame` ループから直接読み書きする。
   - React HUD（ズームレベル計・パンくず・ミニマップ等）へはスロットリング（または変化検出）経由でのみ同期する。

## Alternatives Considered

- **Zustand の採用**:
  - Canvas ループ内から `store.getState()` で同期参照できる利便性は高いが、低頻度 UI 状態と高頻度 `Ref` の責務境界を明示すれば React 標準機能だけで十分にクリーンかつ同等の性能が出せるため、依存を最小化する方針として不採用とした。
- **すべての状態を単一の React State / Context で管理**:
  - パン・ズームのたびに毎フレーム React 再レンダリングが発生し、フレーム落ちの原因になるため不採用。

## Consequences

- **メリット**:
  - 状態管理の外部依存ゼロでバンドルと学習コストを低く保てる。
  - 「React 再レンダリングを起こしてはいけない高頻度状態」が構造上 `Ref` として明確に隔離される。
- **トレードオフ・注意点**:
  - Context の分割粒度やメモ化を雑に扱うと UI 側の再レンダリングが増えるため、State / Dispatch / RuntimeRef の Context 分離を規約として守る必要がある。
