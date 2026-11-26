import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { parseDsl } from '../src/core/dsl/parser';
import { layoutWorkspace } from '../src/core/layout/elkLayout';
import { drawnFrame, drawnLabel, recordMapFrames } from './canvasEvidence';

test.beforeEach(({ page }) => recordMapFrames(page));

const filename = (path: string) => resolve(path);
const breadcrumb = (page: Page) => page.getByRole('navigation', { name: '地図の現在地' });
const workspaceButton = (page: Page, name: string) =>
  breadcrumb(page).getByRole('button', { name: `${name} の全体表示`, exact: true });
const map = (page: Page) => page.locator('canvas.map-canvas');
const searchInput = (page: Page) => page.getByRole('combobox', { name: 'スポット検索' });
const presetPicker = (page: Page) => page.getByRole('combobox', { name: 'サンプル' });
const inspector = (page: Page) => page.locator('.inspector');
const openFile = (page: Page, path: string) =>
  page.locator('#dsl-file').setInputFiles(filename(path));
const currentZoom = async (page: Page) =>
  Number.parseFloat(await page.locator('.scale').innerText());
const scaleLevel = (page: Page, level: 'L1 Context' | 'L2 Container' | 'L3 Component') =>
  expect(page.getByRole('button', { name: level })).toHaveAttribute('aria-pressed', 'true');

async function ready(page: Page) {
  await page.goto('/');
  await expect(workspaceButton(page, 'CloudShop Platform')).toBeVisible();
}

async function search(page: Page, name: string) {
  await page.keyboard.press('/');
  await expect(searchInput(page)).toBeFocused();
  await searchInput(page).fill(name);
  await expect(page.getByRole('option', { name: new RegExp(name, 'i') }).first()).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(inspector(page).getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(map(page)).toBeFocused();
}

async function pickSample(page: Page, value: string, name: string) {
  const menu = page.getByRole('button', { name: '地図メニュー' });
  if ((await menu.isVisible()) && !(await presetPicker(page).isVisible())) await menu.click();
  await presetPicker(page).selectOption(value);
  await expect(workspaceButton(page, name)).toBeVisible();
  await map(page).focus();
}

async function dropFile(page: Page, path: string) {
  const text = readFileSync(filename(path), 'utf8');
  const dataTransfer = await page.evaluateHandle(
    ({ file, text }) => {
      const data = new DataTransfer();
      data.items.add(new File([text], file, { type: 'text/plain' }));
      return data;
    },
    { file: path.split('/').at(-1)!, text },
  );
  await map(page).dispatchEvent('dragenter', { dataTransfer });
  await expect(page.getByText('ここに .dsl ファイルをドロップ')).toBeVisible();
  await map(page).dispatchEvent('dragover', { dataTransfer });
  await map(page).dispatchEvent('drop', { dataTransfer });
  await dataTransfer.dispose();
  await expect(page.getByText('ここに .dsl ファイルをドロップ')).toHaveCount(0);
}

test('ホイール、ドラッグ、ミニマップ、ダブルクリック、全体表示で地図を操作する', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await pickSample(page, 'minimal', 'Workspace');
  await drawnLabel(page, 'Uses');
  const initial = await currentZoom(page);
  const canvas = await map(page).boundingBox();
  expect(canvas).not.toBeNull();
  const mid = { x: canvas!.width / 2, y: canvas!.height / 2 };
  await page.mouse.move(mid.x, mid.y);
  await page.mouse.wheel(0, -120);
  await expect.poll(() => currentZoom(page)).toBeGreaterThan(initial);
  await page.getByRole('button', { name: '全体表示', exact: true }).click();
  await expect.poll(() => currentZoom(page)).toBeCloseTo(initial, 2);

  await search(page, 'User');
  const spot = await drawnLabel(page, 'User');
  await page.keyboard.press('Escape');
  await expect(inspector(page)).toHaveCount(0);
  await page.mouse.click(spot.x + 8, spot.y);
  await expect(inspector(page).getByRole('heading', { name: 'User', exact: true })).toBeVisible();
  const beforeDoubleClick = await currentZoom(page);
  await page.mouse.dblclick(spot.x + 8, spot.y);
  await expect.poll(() => currentZoom(page)).toBeGreaterThan(beforeDoubleClick);
  await page.mouse.move(mid.x, mid.y);
  await page.mouse.down();
  await page.mouse.move(mid.x - 265, mid.y - 160, { steps: 8 });
  await page.mouse.up();
  await expect(inspector(page).getByRole('heading', { name: 'User', exact: true })).toBeVisible();
  const canvasAfterPan = await map(page).evaluate((element: HTMLCanvasElement) =>
    element.toDataURL(),
  );
  const minimap = await page.getByRole('button', { name: 'ミニマップで地図を移動' }).boundingBox();
  await page.mouse.move(minimap!.x + 25, minimap!.y + 41);
  await page.mouse.down();
  await page.mouse.move(minimap!.x + 87, minimap!.y + 64, { steps: 4 });
  await page.mouse.up();
  await expect
    .poll(() => map(page).evaluate((element: HTMLCanvasElement) => element.toDataURL()))
    .not.toBe(canvasAfterPan);
});

test('CloudShop と Big Bank をキーボードで L1 から L3 まで探索する', async ({ page }) => {
  await ready(page);
  for (const { sample, root, component, container, system } of [
    {
      sample: 'cloudshop',
      root: 'CloudShop Platform',
      component: 'Checkout Service',
      container: 'Order API',
      system: 'Commerce Platform',
    },
    {
      sample: 'bank',
      root: 'Big Bank plc',
      component: 'Security Component',
      container: 'API Application',
      system: 'Internet Banking System',
    },
  ]) {
    if (sample !== 'cloudshop') await pickSample(page, sample, root);
    await search(page, component);
    await scaleLevel(page, 'L3 Component');
    await page.keyboard.press('1');
    await scaleLevel(page, 'L1 Context');
    await page.keyboard.press('2');
    await scaleLevel(page, 'L2 Container');
    await expect(breadcrumb(page).getByRole('button', { name: system, exact: true })).toBeVisible();
    await page.keyboard.press('3');
    await scaleLevel(page, 'L3 Component');
    await expect(
      breadcrumb(page).getByRole('button', { name: container, exact: true }),
    ).toBeVisible();
    await breadcrumb(page).getByRole('button', { name: container, exact: true }).click();
    await expect(
      breadcrumb(page).getByRole('button', { name: container, exact: true }),
    ).toBeVisible();
  }
});

test('Big Bank の集約関係を実際の Canvas で選択し、元の 4 関係を確認する', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await pickSample(page, 'bank', 'Big Bank plc');
  await scaleLevel(page, 'L1 Context');
  const label = await drawnLabel(page, /4件/);
  await page.mouse.click(label.x + 4, label.y);
  await expect(inspector(page).getByRole('heading', { name: '関係の内訳 4 件' })).toBeVisible();
  await expect(
    inspector(page).getByRole('heading', { name: 'Personal Banking Customer → Web Application' }),
  ).toBeVisible();
});

test('NovaBank で上流／下流を分け、直接と推移的な依存を切り替える', async ({ page }) => {
  await ready(page);
  await pickSample(page, 'nova', 'NovaBank Event Mesh');
  await search(page, 'Transfer Endpoint');
  const upstream = inspector(page).locator('section.upstream');
  const downstream = inspector(page).locator('section.downstream');
  await expect(upstream.getByRole('button', { name: 'ML Scorer' })).toBeVisible();
  await expect(downstream.getByRole('button', { name: 'ML Scorer' })).toHaveCount(0);
  await expect(downstream.getByRole('button', { name: 'Feature Fetcher' })).toBeVisible();
  await page.getByRole('button', { name: '推移的' }).click();
  await expect(downstream.getByRole('button', { name: 'ML Scorer' })).toBeVisible();
  await downstream.getByRole('button', { name: 'ML Scorer' }).click();
  await expect(
    inspector(page).getByRole('heading', { name: 'ML Scorer', exact: true }),
  ).toBeVisible();
  await expect(
    breadcrumb(page).getByRole('button', { name: 'ML Scorer', exact: true }),
  ).toHaveAttribute('aria-current', 'location');
});

test('DSL をファイル選択・ドロップで開き、構文エラーで地図・選択・倍率を維持する', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  const fileChooser = page.waitForEvent('filechooser');
  await page.keyboard.press('o');
  await (await fileChooser).setFiles(filename('docs/architecture/workspace.dsl'));
  await expect(workspaceButton(page, 'c4-zoom')).toBeVisible();
  await search(page, 'Canvas 2D Cartography Renderer');
  await scaleLevel(page, 'L3 Component');
  expect(
    (await breadcrumb(page).getByRole('button').allTextContents()).filter((name) =>
      name.includes('c4-zoom'),
    ),
  ).toHaveLength(1);
  const beforeZoom = await currentZoom(page);
  await dropFile(page, 'fixtures/dsl/custom/invalid-syntax.dsl');
  const diagnostics = page.getByRole('region', { name: 'DSL 診断' });
  await expect(diagnostics.getByText('エラー · 15 行 1 列').first()).toBeVisible();
  await expect(diagnostics.getByText('警告 · 12 行 18 列')).toBeVisible();
  await expect(
    inspector(page).getByRole('heading', { name: 'Canvas 2D Cartography Renderer' }),
  ).toBeVisible();
  expect(await currentZoom(page)).toBe(beforeZoom);
  const diagnosticBox = (await diagnostics.boundingBox())!;
  const inspectorBox = (await inspector(page).boundingBox())!;
  const bar = (await page.locator('.top-bar').boundingBox())!;
  expect(diagnosticBox.x + diagnosticBox.width).toBeLessThan(inspectorBox.x);
  expect(diagnosticBox.y).toBeGreaterThan(bar.y + bar.height);
  await expect(page.getByRole('button', { name: 'DSL を開く' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(diagnostics).toHaveCount(0);
  await expect(page.getByRole('button', { name: /診断/ })).toBeFocused();
  await expect(inspector(page)).toBeVisible();
  await page.reload();
  await expect(workspaceButton(page, 'c4-zoom')).toBeVisible();
  await openFile(page, 'fixtures/dsl/upstream/getting-started.dsl');
  await expect(workspaceButton(page, 'Workspace')).toBeVisible();
});

test('公式 DSL の全サンプルをファイル選択とドロップで表示する', async ({ page }) => {
  await ready(page);
  const fixtures = [
    ['amazon-web-services', 'Amazon Web Services Example', 'Spring PetClinic'],
    ['big-bank-plc', 'Big Bank plc', 'Internet Banking System'],
    ['financial-risk-system', 'Financial Risk System', 'Active Directory'],
    ['getting-started', 'Workspace', 'User'],
    ['groups-nested', 'Workspace', 'B Database'],
    ['hierarchical-identifiers', 'Workspace', 'C'],
    ['spring-petclinic', 'Spring PetClinic', 'Relational Database Schema'],
    ['this', 'Workspace', 'Container'],
  ] as const;
  for (const [index, [slug, workspace, spot]] of fixtures.entries()) {
    const path = `fixtures/dsl/upstream/${slug}.dsl`;
    if (index % 2 === 0) await openFile(page, path);
    else await dropFile(page, path);
    await expect(page.getByText(`${slug}.dsl`, { exact: true })).toBeVisible();
    await expect(workspaceButton(page, workspace)).toBeVisible();
    await search(page, spot);
  }
});

test('配置のドラッグとキーボード調整、再読込、自動配置へのリセット', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await pickSample(page, 'minimal', 'Workspace');
  await search(page, 'User');
  const label = await drawnLabel(page, 'User');
  await page.getByRole('button', { name: '配置調整', exact: true }).click();
  const mid = { x: label.x + 8, y: label.y };
  await page.mouse.move(mid.x, mid.y);
  await page.mouse.down();
  await page.mouse.move(mid.x + 95, mid.y + 28, { steps: 8 });
  await page.mouse.up();
  const reset = page.getByRole('button', { name: 'この要素の位置をリセット' });
  await expect(reset).toBeVisible();
  await page.reload();
  await expect(workspaceButton(page, 'Workspace')).toBeVisible();
  await search(page, 'User');
  await expect(reset).toBeVisible();
  await reset.click();
  await expect(reset).toHaveCount(0);
  await page.getByRole('button', { name: '配置調整', exact: true }).click();
  await page.getByRole('button', { name: '要素を上に移動' }).focus();
  await page.keyboard.press('Enter');
  await expect(reset).toBeVisible();
  await page.getByRole('button', { name: '全配置をリセット' }).click();
  await expect(reset).toHaveCount(0);
  await page.reload();
  await expect(workspaceButton(page, 'Workspace')).toBeVisible();
  await search(page, 'User');
  await expect(reset).toHaveCount(0);
});

test.describe('390 × 844 のタッチ画面', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });

  test('狭い画面で検索、テーマ切替と空のモデルからの復帰ができる', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await ready(page);
    const menu = page.getByRole('button', { name: '地図メニュー' });
    const top = (await page.locator('.top-bar').boundingBox())!;
    const bottom = (await page.locator('.zoom-controls').boundingBox())!;
    expect(top.y + top.height).toBeLessThan(105);
    expect(bottom.height).toBeLessThan(53);
    await expect(page.locator('.search-field kbd')).toBeHidden();
    await expect(page.getByRole('button', { name: 'ミニマップで地図を移動' })).toBeHidden();
    const customer = await drawnLabel(page, 'Customer');
    expect(customer.y).toBeGreaterThan(top.y + top.height);
    await menu.click();
    await page.getByRole('button', { name: 'ダークテーマに変更' }).click();
    await menu.click();
    await expect(page.locator('main')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('combobox', { name: 'スポット検索' }).fill('検索に存在しない要素');
    await expect(page.getByText('該当する要素がありません。')).toBeVisible();
    await page.keyboard.press('Escape');
    await search(page, 'Checkout Service');
    await expect(page.getByRole('button', { name: 'ミニマップで地図を移動' })).toBeHidden();
    const info = (await inspector(page).boundingBox())!;
    expect(info.x + info.width).toBeLessThanOrEqual(390);
    expect(info.height).toBeLessThan(86);
    const selected = await drawnLabel(page, 'Checkout Service');
    expect(selected.y).toBeLessThan(info.y - 12);
    const toggle = page.getByRole('button', { name: '詳しく' });
    await toggle.tap();
    const expanded = page.getByRole('button', { name: '要約' });
    await expect(expanded).toHaveAttribute('aria-expanded', 'true');
    await expect(inspector(page).getByText('依存関係')).toBeVisible();
    expect((await drawnLabel(page, 'Checkout Service')).y).toBeLessThan(
      (await inspector(page).boundingBox())!.y,
    );
    await expanded.tap();
    await page.getByRole('button', { name: '詳細を閉じる' }).click();
    await expect(map(page)).toBeFocused();
    await page.locator('#dsl-file').setInputFiles({
      name: 'empty.dsl',
      mimeType: 'text/plain',
      buffer: Buffer.from('workspace { model {} }'),
    });
    await expect(page.getByRole('heading', { name: '表示できる要素がありません' })).toBeVisible();
    await pickSample(page, 'minimal', 'Workspace');
    await expect(page.getByRole('heading', { name: '表示できる要素がありません' })).toHaveCount(0);
    await page.reload();
    await menu.click();
    await expect(page.getByRole('button', { name: 'ライトテーマに変更' })).toBeVisible();
  });

  test('ピンチ後に残った指でパンし、ノードと背景をダブルタップする', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await ready(page);
    await pickSample(page, 'minimal', 'Workspace');
    await drawnLabel(page, 'Uses');
    const before = await currentZoom(page);
    const cdp = await page.context().newCDPSession(page);
    const touch = (x: number, y: number, id: number) => ({ x, y, id });
    const beforePan = (await drawnFrame(page)).rects[0]!;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [touch(155, 430, 1)],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [touch(195, 430, 1)],
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect
      .poll(async () => Math.round((await drawnFrame(page)).rects[0]!.x - beforePan.x))
      .toBe(40);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [touch(145, 430, 1)],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [touch(145, 430, 1), touch(235, 430, 2)],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [touch(110, 430, 1), touch(270, 430, 2)],
    });
    await expect.poll(() => currentZoom(page)).toBeGreaterThan(before * 1.25);
    const pinched = await currentZoom(page);
    const prior = (await drawnFrame(page)).rects[0];
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [touch(270, 430, 2)],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [touch(157, 430, 1)],
    });
    await expect
      .poll(async () => Math.round((await drawnFrame(page)).rects[0]!.x - prior!.x))
      .toBe(47);
    expect(await currentZoom(page)).toBe(pinched);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.getByRole('button', { name: '全体表示', exact: true }).tap();
    await expect.poll(() => currentZoom(page)).toBeCloseTo(before, 2);
    const label = await drawnLabel(page, 'User');
    const dbl = async (x: number, y: number) => {
      await page.touchscreen.tap(x, y);
      await page.touchscreen.tap(x, y);
    };
    await dbl(label.x + 4, label.y);
    await expect(inspector(page).getByRole('heading', { name: 'User', exact: true })).toBeVisible();
    await expect.poll(() => currentZoom(page)).toBeGreaterThan(before);
    await page.getByRole('button', { name: '詳細を閉じる' }).tap();
    const zoomed = await currentZoom(page);
    await dbl(320, 217);
    await expect.poll(() => currentZoom(page)).toBeGreaterThan(zoomed);
    expect(errors).toEqual([]);
  });
});

test('保存に失敗しても現在の画面では変更できる', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('denied by test', 'QuotaExceededError');
    };
  });
  await ready(page);
  await expect(page.getByText('ブラウザに保存できませんでした。', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'ダークテーマに変更' }).click();
  await expect(page.getByRole('button', { name: 'ライトテーマに変更' })).toBeVisible();
  await search(page, 'Checkout Service');
});

test('Canvas に Uses と技術・説明を描画し、検索の着地点が詳細欄に隠れない', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await pickSample(page, 'minimal', 'Workspace');
  await drawnLabel(page, 'Uses');
  await expect(page.getByRole('button', { name: 'L2 Container' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'L3 Component' })).toBeDisabled();
  await pickSample(page, 'cloudshop', 'CloudShop Platform');
  await scaleLevel(page, 'L1 Context');
  await search(page, 'Checkout Service');
  const label = await drawnLabel(page, 'Checkout Service');
  const inspectorBox = (await inspector(page).boundingBox())!;
  expect(label.x).toBeLessThan(inspectorBox.x - 100);
  await drawnLabel(page, 'Go');
  await drawnLabel(page, /在庫仮押さえ/);
  await expect(map(page)).toHaveCSS('outline-style', 'none');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(map(page)).toHaveCSS('outline-style', 'solid');
  await page.mouse.click(label.x, label.y);
  await expect(map(page)).toHaveCSS('outline-style', 'none');
});

test('Big Bank のレベルボタンで全兄弟を表示し、画面外へ出た親の見出しを固定する', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await pickSample(page, 'bank', 'Big Bank plc');
  await scaleLevel(page, 'L1 Context');
  await drawnLabel(page, 'Internet Banking System');
  expect(
    (await drawnFrame(page)).labels.some(
      ({ text }) => text === 'Sign In Controller' || text === 'Mobile App',
    ),
  ).toBe(false);
  const workspace = parseDsl(
    readFileSync(filename('fixtures/dsl/upstream/big-bank-plc.dsl'), 'utf8'),
  ).workspace!;
  const graph = await layoutWorkspace(workspace);
  for (const [level, id] of [
    ['L2 Container', 'internetBankingSystem'],
    ['L3 Component', 'internetBankingSystem.apiApplication'],
  ] as const) {
    await page.getByRole('button', { name: level }).click();
    await scaleLevel(page, level);
    const parent = graph.nodes[id]!;
    const frame = await drawnFrame(page);
    const shape = frame.rects.find(
      (rect) =>
        rect.width > 300 &&
        Math.abs(rect.width / rect.height - parent.width / parent.height) < 1e-8,
    )!;
    expect(shape).toBeDefined();
    const top = (await page.locator('.top-bar').boundingBox())!;
    const bottom = (await page.locator('.zoom-controls').boundingBox())!;
    expect(shape.x).toBeGreaterThan(0);
    expect(shape.y).toBeGreaterThan(top.y + top.height);
    expect(shape.x + shape.width).toBeLessThan(1440);
    expect(shape.y + shape.height).toBeLessThan(bottom.y);
    const factor = shape.width / parent.width;
    for (const childId of parent.element.childrenIds) {
      const child = graph.nodes[childId]!;
      expect(
        frame.rects.some(
          (rect) =>
            Math.abs(rect.x - shape.x - (child.x - parent.x) * factor) < 0.02 &&
            Math.abs(rect.y - shape.y - (child.y - parent.y) * factor) < 0.02 &&
            Math.abs(rect.width - child.width * factor) < 0.02,
        ),
      ).toBe(true);
    }
    const heading = await drawnLabel(page, parent.element.name);
    expect(heading.y).toBeLessThan(shape.y + factor * 66);
  }
  const sticky = await drawnLabel(page, 'Internet Banking System');
  const top = (await page.locator('.top-bar').boundingBox())!;
  expect(sticky.y).toBeGreaterThan(top.y + top.height);
  expect(sticky.y).toBeLessThan(top.y + top.height + 75);
});

test('ホイールは一段ずつ拡大し、連続スクロールはパンを保つ', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await pickSample(page, 'minimal', 'Workspace');
  await drawnLabel(page, 'Uses');
  const initial = await currentZoom(page);
  await page.mouse.move(680, 450);
  await page.mouse.wheel(0, -120);
  await expect.poll(() => currentZoom(page)).toBeCloseTo(initial * Math.exp(0.174), 1);
  const wheel = (args: {
    deltaX?: number;
    deltaY: number;
    ctrlKey?: boolean;
    shiftKey?: boolean;
  }) => map(page).dispatchEvent('wheel', { ...args, clientX: 680, clientY: 450 });
  await page.getByRole('button', { name: '全体表示', exact: true }).click();
  await expect.poll(() => currentZoom(page)).toBeCloseTo(initial, 2);
  await wheel({ deltaY: 26.5, deltaX: 1.25, shiftKey: true });
  const original = (await drawnFrame(page)).rects[0]!;
  await wheel({ deltaY: 26.5, deltaX: 12.25 });
  await wheel({ deltaY: 120 });
  await expect
    .poll(async () => (await drawnFrame(page)).rects[0]!.y)
    .toBeLessThan(original.y - 140);
  expect(await currentZoom(page)).toBe(initial);
  await wheel({ deltaY: -40, ctrlKey: true });
  await expect.poll(() => currentZoom(page)).toBeGreaterThan(initial * 1.1);
});

test('NovaBank の複数プロトコルと内部・循環エッジを Canvas に描く', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await pickSample(page, 'nova', 'NovaBank Event Mesh');
  await drawnLabel(page, /gRPC.*(?:Kafka|\+2).*3件/);
  await search(page, 'Transfer Engine');
  await page.keyboard.press('3');
  await scaleLevel(page, 'L3 Component');
  await expect
    .poll(async () =>
      (await drawnFrame(page)).strokes.some(
        ({ color, opacity }) => color === '#748ea1' && opacity === 1,
      ),
    )
    .toBe(true);
  await search(page, 'ML Scorer');
  await page.getByRole('button', { name: '推移的' }).click();
  await expect(inspector(page).getByText(/循環経路/)).toBeVisible();
  await expect
    .poll(async () =>
      (await drawnFrame(page)).strokes.some(
        ({ color, opacity }) => color === '#9b5c16' && opacity === 1,
      ),
    )
    .toBe(true);
});
