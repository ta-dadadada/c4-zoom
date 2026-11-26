import type { ElementKind } from '../core/model/types';

export const kindLabel: Record<ElementKind, string> = {
  person: '利用者',
  softwareSystem: 'システム',
  container: 'コンテナ',
  component: 'コンポーネント',
  group: 'グループ',
  element: '汎用要素',
};
