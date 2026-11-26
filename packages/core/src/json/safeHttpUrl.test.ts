import { expect, it } from 'vitest';
import { safeHttpUrl } from './safeHttpUrl.js';

it.each(['http://example.com/', 'https://example.com/path'])(
  'allows the HTTP(S) link %s',
  (url) => {
    expect(safeHttpUrl(url)).toBe(url);
  },
);

it.each([
  undefined,
  'javascript:void(0)',
  'data:text/plain,open',
  'file:///local',
  'mailto:user@example.com',
  '//example.com/',
  '/relative',
])('leaves %s without an external link', (url) => {
  expect(safeHttpUrl(url)).toBeUndefined();
});
