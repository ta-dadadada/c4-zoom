import { expect, type Page } from '@playwright/test';
import type { Rect } from '../src/core/layout/types';

interface Label {
  text: string;
  x: number;
  y: number;
  opacity: number;
}

interface CanvasFrame {
  labels: Label[];
  rects: Rect[];
  strokes: { color: string; opacity: number }[];
}

declare global {
  interface Window {
    canvasFrame: CanvasFrame;
  }
}

export async function recordMapFrames(page: Page) {
  await page.addInitScript(() => {
    const context = CanvasRenderingContext2D.prototype;
    const { fillRect, fillText, roundRect, quadraticCurveTo } = context;
    const isMap = (ctx: CanvasRenderingContext2D) => ctx.canvas.classList.contains('map-canvas');
    window.canvasFrame = { labels: [], rects: [], strokes: [] };
    context.fillRect = function (...args) {
      if (isMap(this) && args[0] === 0 && args[1] === 0)
        window.canvasFrame = { labels: [], rects: [], strokes: [] };
      fillRect.apply(this, args);
    };
    context.fillText = function (...args) {
      if (isMap(this))
        window.canvasFrame.labels.push({
          text: args[0],
          x: args[1],
          y: args[2],
          opacity: this.globalAlpha,
        });
      fillText.apply(this, args);
    };
    context.quadraticCurveTo = function (...args) {
      if (isMap(this))
        window.canvasFrame.strokes.push({
          color: String(this.strokeStyle),
          opacity: this.globalAlpha,
        });
      quadraticCurveTo.apply(this, args);
    };
    context.roundRect = function (...args) {
      if (isMap(this))
        window.canvasFrame.rects.push({ x: args[0], y: args[1], width: args[2], height: args[3] });
      roundRect.apply(this, args);
    };
  });
}

export const drawnFrame = (page: Page) => page.evaluate(() => window.canvasFrame);

export async function drawnLabel(page: Page, text: string | RegExp): Promise<Label> {
  const find = async () =>
    (await drawnFrame(page)).labels.find((label) =>
      typeof text === 'string' ? text === label.text : text.test(label.text),
    );
  await expect.poll(find).toBeDefined();
  return (await find())!;
}
