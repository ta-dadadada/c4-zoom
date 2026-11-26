import type { C4Element } from '../model/types.js';

export type ThemeName = 'light' | 'dark';
type Role =
  | 'district'
  | 'external'
  | 'actor'
  | 'web'
  | 'service'
  | 'database'
  | 'queue'
  | 'module'
  | 'group';
type Colors = readonly [fill: string, stroke: string, accent: string];

export interface Theme {
  background: string;
  grid: string;
  gridMajor: string;
  ink: string;
  muted: string;
  surface: string;
  edge: string;
  upstream: string;
  downstream: string;
  cyclic: string;
  focus: string;
  shadow: string;
  roles: Record<Role, Colors>;
}

export const themes: Record<ThemeName, Theme> = {
  light: {
    background: '#F4F6F8',
    grid: '#E8EDF2',
    gridMajor: '#DEE7EE',
    ink: '#18354B',
    muted: '#4B6375',
    surface: '#FFFFFF',
    edge: '#748EA1',
    upstream: '#4F46E5',
    downstream: '#087F74',
    cyclic: '#9B5C16',
    focus: '#0E6374',
    shadow: '#153A5423',
    roles: {
      district: ['#EEF4FB', '#93B4D8', '#386A93'],
      external: ['#F1F2F4', '#94A3B8', '#516378'],
      actor: ['#EEF2FF', '#A5B4FC', '#514BB6'],
      web: ['#FFFFFF', '#ACC3D7', '#2970AC'],
      service: ['#FFFFFF', '#ADC7CD', '#207F82'],
      database: ['#FFF9EA', '#D4B874', '#936019'],
      queue: ['#FAF5FE', '#C6AEDC', '#79529C'],
      module: ['#F8FAFC', '#CBD5E1', '#3E7481'],
      group: ['#E7EFF5', '#96AAB9', '#536D80'],
    },
  },
  dark: {
    background: '#1A252E',
    grid: '#25343E',
    gridMajor: '#30434D',
    ink: '#E9F2F5',
    muted: '#B1C4D1',
    surface: '#253641',
    edge: '#88A4B4',
    upstream: '#A9A4FF',
    downstream: '#55D8BD',
    cyclic: '#F4BC6A',
    focus: '#79DEE4',
    shadow: '#00000055',
    roles: {
      district: ['#263C50', '#547D9F', '#A0C9E9'],
      external: ['#2C3841', '#6D8494', '#BBCAD2'],
      actor: ['#32355A', '#777DB1', '#C6C9FF'],
      web: ['#253B4D', '#557E9D', '#9DCCF5'],
      service: ['#253C44', '#548087', '#8CD5CB'],
      database: ['#433B2D', '#8F7754', '#F4C57B'],
      queue: ['#3C324A', '#816B9D', '#D5B6F1'],
      module: ['#293C48', '#5F7889', '#AAD5DE'],
      group: ['#2C4655', '#5C7B8C', '#B0C9D6'],
    },
  },
};

export function elementRole(element: C4Element): Role {
  switch (element.kind) {
    case 'person':
      return 'actor';
    case 'group':
      return 'group';
    case 'softwareSystem':
      return element.tags.some((tag) => tag.toLowerCase() === 'external') ? 'external' : 'district';
    case 'component':
      return 'module';
    default: {
      const words = [element.name, element.technology, ...element.tags].join(' ').toLowerCase();
      if (
        /\b(database|db|redis|postgres(?:ql)?|mysql|bigquery|cockroachdb|opensearch|warehouse)\b/.test(
          words,
        )
      )
        return 'database';
      if (/\b(queue|broker|kafka|event bus|stream)\b/.test(words)) return 'queue';
      if (/\b(web|browser|mobile|dashboard)\b/.test(words)) return 'web';
      return 'service';
    }
  }
}
