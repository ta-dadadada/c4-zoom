import { useLayoutEffect, useRef, type PointerEvent } from 'react';
import { screenToWorld } from '../core/camera/camera';
import { center } from '../core/layout/bounds';
import { minimapCamera, renderMinimap } from '../core/renderer/canvasRenderer';
import { themes } from '../core/renderer/theme';
import { useAppState, useCanvasRuntime, useHud } from '../state/AppStateContext';
import { moveMap, panMap } from '../state/runtime';

export function Minimap() {
  const { active, theme } = useAppState();
  const hud = useHud();
  const canvas = useRef<HTMLCanvasElement>(null);
  const runtime = useCanvasRuntime();

  useLayoutEffect(() => {
    const element = canvas.current;
    const graph = runtime.graph;
    const ctx = element?.getContext('2d');
    if (!element || !ctx || !graph) return;
    function draw() {
      const rect = element!.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const ratio = devicePixelRatio || 1;
      element!.width = Math.round(rect.width * ratio);
      element!.height = Math.round(rect.height * ratio);
      ctx!.setTransform(ratio, 0, 0, ratio, 0, 0);
      renderMinimap(ctx!, graph!, hud.camera, hud.viewport, rect, themes[theme]);
    }
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(element);
    return () => observer.disconnect();
  }, [active, hud, theme, runtime]);

  function move(event: PointerEvent<HTMLButtonElement>) {
    const graph = runtime.graph;
    const rect = canvas.current?.getBoundingClientRect();
    if (!graph || !rect || !rect.width || !rect.height) return;
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    moveMap(runtime, screenToWorld(point, minimapCamera(graph, rect), rect));
  }

  if (!active?.graph.workspace.rootIds.length) return null;
  return (
    <button
      type="button"
      className="glass minimap"
      aria-label="ミニマップで地図を移動"
      title="クリックまたはドラッグで移動。キーボードでは矢印キーで移動。"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        move(event);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) move(event);
      }}
      onClick={(event) => {
        if (event.detail === 0 && runtime.graph) moveMap(runtime, center(runtime.graph.bounds));
      }}
      onKeyDown={(event) => {
        const x = event.key === 'ArrowLeft' ? 1 : event.key === 'ArrowRight' ? -1 : 0;
        const y = event.key === 'ArrowUp' ? 1 : event.key === 'ArrowDown' ? -1 : 0;
        if (!x && !y) return;
        event.preventDefault();
        panMap(runtime, { x: x * 100, y: y * 100 });
      }}
    >
      <span>ミニマップ</span>
      <canvas ref={canvas} aria-hidden="true" />
    </button>
  );
}
