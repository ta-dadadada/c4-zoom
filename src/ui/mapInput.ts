import { screenToWorld, zoomAt } from '../core/camera/camera';
import type { Offset, Offsets, Point } from '../core/layout/types';
import { hitTest, type Selection } from '../core/renderer/hitTest';
import { aimZoom, focusCanvas, panMap, stopMotion, type Runtime } from '../state/runtime';

interface Drag {
  pointer: number;
  start: Point;
  previous: Point;
  at: number;
  move?: { id: string; offset: Offset; zoom: number };
  moved: boolean;
}

function pointerCoordinates(
  event: PointerEvent | WheelEvent | MouseEvent,
  canvas: HTMLCanvasElement,
): Point {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

export function attachMapInput(
  element: HTMLCanvasElement,
  runtime: Runtime,
  readInputs: () => { editing: boolean; offsets: Offsets },
  select: (hit: Selection | null, navigate?: boolean) => void,
  commitOffset: (id: string, offset: Offset) => void,
) {
  let drag: Drag | null = null;
  let moving = false;
  let space = false;
  let pinching = false;
  const touches = new Map<number, Point>();
  let latestTouch = -Infinity;
  let lastTap: { at: number; point: Point; hit: Selection | null } | undefined;
  function updateCursor() {
    element.classList.toggle('dragging', moving);
  }
  function cancel() {
    const captured = new Set([...(drag ? [drag.pointer] : []), ...touches.keys()]);
    touches.clear();
    pinching = false;
    drag = null;
    moving = false;
    runtime.preview = null;
    runtime.dirty = true;
    updateCursor();
    for (const id of captured) if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
  }

  function down(event: PointerEvent) {
    if (event.button !== 0) return;
    const at = pointerCoordinates(event, element);
    if (event.pointerType === 'touch') touches.set(event.pointerId, at);
    else if (drag) return;
    element.setPointerCapture(event.pointerId);
    focusCanvas(runtime);
    stopMotion(runtime);

    if (touches.size > 1) {
      lastTap = undefined;
      pinching = true;
      drag = null;
      runtime.preview = null;
      moving = true;
      runtime.dirty = true;
      updateCursor();
      return;
    }

    const hit = hitTest(runtime.scene, at);
    drag = {
      pointer: event.pointerId,
      start: at,
      previous: at,
      at: event.timeStamp,
      moved: false,
    };
    if (!space && hit?.kind === 'node' && (event.altKey || readInputs().editing)) {
      const { offsets } = readInputs();
      const offset = Object.hasOwn(offsets, hit.id) ? offsets[hit.id] : undefined;
      drag.move = { id: hit.id, offset: offset ?? { dx: 0, dy: 0 }, zoom: runtime.camera.zoom };
    }
  }

  function move(event: PointerEvent) {
    const point = pointerCoordinates(event, element);
    runtime.pointer = point;
    runtime.dirty = true;
    if (pinching && touches.has(event.pointerId)) {
      const other = [...touches].find(([id]) => id !== event.pointerId)?.[1];
      const previous = touches.get(event.pointerId)!;
      touches.set(event.pointerId, point);
      if (!other) return;
      const middle = { x: (point.x + other.x) / 2, y: (point.y + other.y) / 2 };
      const prior = { x: (previous.x + other.x) / 2, y: (previous.y + other.y) / 2 };
      const distance = Math.hypot(point.x - other.x, point.y - other.y);
      const before = Math.hypot(previous.x - other.x, previous.y - other.y);
      if (before > 4 && distance > 4) {
        runtime.atOverview = false;
        const world = screenToWorld(prior, runtime.camera, runtime.viewport);
        runtime.camera = zoomAt(
          runtime.camera,
          (runtime.camera.zoom * distance) / before,
          prior,
          runtime.viewport,
        );
        runtime.camera = {
          ...runtime.camera,
          x: world.x - (middle.x - runtime.viewport.width / 2) / runtime.camera.zoom,
          y: world.y - (middle.y - runtime.viewport.height / 2) / runtime.camera.zoom,
        };
      }
      return;
    }
    if (touches.has(event.pointerId)) touches.set(event.pointerId, point);
    if (!drag || event.pointerId !== drag.pointer) return;

    const dx = point.x - drag.start.x;
    const dy = point.y - drag.start.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    lastTap = undefined;
    moving = true;
    updateCursor();
    if (drag.move) {
      const { id, offset, zoom } = drag.move;
      runtime.preview = { id, offset: { dx: offset.dx + dx / zoom, dy: offset.dy + dy / zoom } };
    } else {
      const delta = { x: point.x - drag.previous.x, y: point.y - drag.previous.y };
      const elapsed = Math.max(8, event.timeStamp - drag.at);
      const velocity = runtime.velocity;
      panMap(runtime, delta);
      runtime.velocity = {
        x: Math.max(-2.5, Math.min(2.5, (delta.x / elapsed) * 0.75 + velocity.x * 0.25)),
        y: Math.max(-2.5, Math.min(2.5, (delta.y / elapsed) * 0.75 + velocity.y * 0.25)),
      };
    }
    drag.previous = point;
    drag.at = event.timeStamp;
  }

  function tap(point: Point, at: number, hit: Selection | null) {
    const previous = lastTap;
    if (
      previous &&
      at - previous.at <= 300 &&
      Math.hypot(point.x - previous.point.x, point.y - previous.point.y) < 24
    ) {
      lastTap = undefined;
      if (previous.hit?.kind === 'node' && !readInputs().editing) select(previous.hit, true);
      else if (!previous.hit) aimZoom(runtime, 1.55, point);
      return;
    }
    lastTap = { at, point, hit };
    select(hit);
  }

  function up(event: PointerEvent) {
    const touch = event.pointerType === 'touch';
    if (touch) {
      latestTouch = event.timeStamp;
      touches.delete(event.pointerId);
      if (pinching) {
        if (!touches.size) cancel();
        else if (touches.size === 1) {
          const [pointer, point] = touches.entries().next().value!;
          pinching = false;
          // 残った指の現在位置から、拡大率を維持してパンを続ける。
          drag = { pointer, start: point, previous: point, at: event.timeStamp, moved: true };
        }
        return;
      }
    }
    if (!drag || drag.pointer !== event.pointerId) return;
    const current = drag;
    if (!current.moved) {
      const point = pointerCoordinates(event, element);
      const hit = hitTest(runtime.scene, point);
      if (touch) tap(point, event.timeStamp, hit);
      else select(hit);
    }
    if (runtime.preview && current.move) commitOffset(runtime.preview.id, runtime.preview.offset);
    if (event.timeStamp - current.at > 80 || !current.moved || current.move)
      runtime.velocity = { x: 0, y: 0 };
    cancel();
  }

  let wheelMode: 'pan' | 'zoom' = 'pan';
  let lastWheel = -Infinity;
  function wheel(event: WheelEvent) {
    event.preventDefault();
    if (moving) return;
    const multiplier =
      event.deltaMode === 1 ? 32 : event.deltaMode === 2 ? runtime.viewport.height : 1;
    if (event.ctrlKey) {
      lastWheel = -Infinity;
    } else if (event.shiftKey || event.timeStamp - lastWheel > 165) {
      const units = Math.abs(event.deltaY);
      const detent = units > 0 && (units % 100 === 0 || units % 120 === 0);
      wheelMode =
        !event.shiftKey && !event.deltaX && (event.deltaMode !== 0 || detent) ? 'zoom' : 'pan';
    }
    if (!event.ctrlKey) lastWheel = event.timeStamp;
    if (!event.ctrlKey && (event.shiftKey || wheelMode === 'pan')) {
      const horizontal = event.shiftKey ? event.deltaX || event.deltaY : event.deltaX;
      panMap(runtime, {
        x: -horizontal * multiplier,
        y: event.shiftKey ? 0 : -event.deltaY * multiplier,
      });
      return;
    }
    const amount = -event.deltaY * multiplier * (event.ctrlKey ? 0.004 : 0.00145);
    aimZoom(
      runtime,
      Math.exp(Math.max(-0.28, Math.min(0.28, amount))),
      pointerCoordinates(event, element),
    );
  }

  function doubleClick(event: MouseEvent) {
    if (event.timeStamp - latestTouch < 380 || event.altKey || readInputs().editing) return;
    const point = pointerCoordinates(event, element);
    const hit = hitTest(runtime.scene, point);
    if (hit?.kind === 'node') select(hit, true);
    else aimZoom(runtime, 1.55, point);
  }

  function keyDown(event: KeyboardEvent) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.code === 'Space') {
      event.preventDefault();
      space = true;
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const id = runtime.hud.path.at(-1);
      if (id) select({ kind: 'node', id });
      return;
    }
    const keys: Record<string, Point> = {
      ArrowLeft: { x: 85, y: 0 },
      ArrowRight: { x: -85, y: 0 },
      ArrowUp: { x: 0, y: 85 },
      ArrowDown: { x: 0, y: -85 },
    };
    const delta = keys[event.key];
    if (delta) {
      event.preventDefault();
      panMap(runtime, delta);
    }
  }

  const resetSpace = () => {
    space = false;
  };
  const leave = () => {
    runtime.pointer = null;
    runtime.dirty = true;
  };
  const abort = () => {
    lastTap = undefined;
    cancel();
    stopMotion(runtime);
  };
  const abortEvents = new AbortController();
  const { signal } = abortEvents;
  element.addEventListener('pointerdown', down, { signal });
  element.addEventListener('pointermove', move, { signal });
  element.addEventListener('pointerup', up, { signal });
  element.addEventListener('pointercancel', abort, { signal });
  element.addEventListener('pointerleave', leave, { signal });
  element.addEventListener('wheel', wheel, { passive: false, signal });
  element.addEventListener('dblclick', doubleClick, { signal });
  element.addEventListener('keydown', keyDown, { signal });
  element.addEventListener(
    'keyup',
    (event) => {
      if (event.code === 'Space') resetSpace();
    },
    { signal },
  );
  element.addEventListener('blur', resetSpace, { signal });
  element.addEventListener(
    'lostpointercapture',
    (event) => {
      if (drag?.pointer === event.pointerId || touches.has(event.pointerId)) abort();
    },
    { signal },
  );
  return {
    cancel,
    isDragging: () => moving,
    dispose() {
      abortEvents.abort();
      cancel();
    },
  };
}
