# 0005: React標準状態管理（Context + useReducer / Ref）およびフロントエンドツールチェーン選定

- **Status**: Accepted
- **Date**: 2026-11-26

## Context

開発着手に先立ち、保守性・実行速度・テスト信頼性を両立するフロントエンド基盤と開発ツールチェーンを確定する必要がある。
本アプリはブラウザ完結型 SPA であり、画面の主役は Canvas 2D エンジン（高頻度状態）、周囲のフローティング UI は低頻度状態（選択ノード、検索結果、テーマ、診断結果など）という明確な役割分担がある。

## Decision

以下の技術スタックおよびツールチェーンを採用する：

- **パッケージマネージャ**: `pnpm`
- **ビルド・言語**: Vite + React + TypeScript（`strict: true`, `noUncheckedIndexedAccess: true`）
- **スタイリング**: Tailwind CSS v4（`@tailwindcss/vite`）
- **状態管理**: **React Context + `useReducer` + `Ref` ブリッジ**（外部状態管理ライブラリは導入しない）
  - 選択状態・モデル・診断・設定等の低頻度 UI 状態は `Context + useReducer` で管理する。
  - カメラ位置・慣性・Fly-to 補間・ホバー状態等の 60fps 高頻度状態は mutable `Ref`（`Canvas Runtime Ref Bridge`）に隔離し、HUD（パンくず・ズーム計・ミニマップ）への反映のみスロットリングする。
- **Lint / Format / Git Hooks**: `oxlint` + `oxfmt` + `lefthook` + `lint-staged`
- **テスト基盤**: **Vitest**（コアロジック単体テスト）＋ **Playwright**（E2E・Canvas 操作の自動ブラウザテスト）

## Alternatives Considered

- **Zustand**: Canvas からの `getState()` 参照は便利だが、低頻度 UI 状態と高頻度 `Ref` の境界を明示設計すれば React 標準機能だけで十分クリーンに収まり、外部依存を減らせるため React 標準構成を採用。
- **ESLint + Prettier**: エコシステムは大きいが設定ファイルと実行時間が重くなりがち。高速でゼロ設定に近い `oxlint` + `oxfmt` を採用。
- **CSS Modules**: 依存は最小だが、フローティングガラス UI やライト／ダークテーマトークンを素早く一貫して組める Tailwind CSS v4 を採用。
- **Vitest のみ（E2E なし）**: Canvas のズーム・パン・Fly-to・D&D ファイル読込の退行を自動検知するため、最初から Playwright も組み込む方針とした。

## Consequences

- **メリット**:
  - `pnpm` + `oxlint` + `oxfmt` により、ローカル開発・pre-commit フック（`lefthook` + `lint-staged`）が極めて高速に回る。
  - 状態管理の外部依存ゼロで構造がシンプルに保たれる。
  - Vitest（ロジック）＋ Playwright（実ブラウザ Canvas 操作）の二段構えでリファクタリング耐性が高い。
- **注意点**:
  - Context の値更新で不要な再レンダリングが広がらないよう、状態 Context と Dispatch / RuntimeRef Context を分離して設計する。
