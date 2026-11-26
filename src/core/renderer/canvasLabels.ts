import { contains, intersects, union } from '../layout/bounds';
import type { Rect } from '../layout/types';
import { smoothstep } from '../lod/lod';
import type { SceneNode } from './hitTest';
import { elementRole, type Theme } from './theme';

const fontFamily = 'system-ui, "Hiragino Sans", "Yu Gothic", sans-serif';
export const setFont = (ctx: CanvasRenderingContext2D, size: number, weight = 500) => {
  ctx.font = `${weight} ${size}px ${fontFamily}`;
};

export function roundedRect(ctx: CanvasRenderingContext2D, rect: Rect, radius: number) {
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.width, rect.height, radius);
}

export function shorten(ctx: CanvasRenderingContext2D, text: string, width: number) {
  if (width < 10) return '';
  if (ctx.measureText(text).width <= width) return text;
  const chars = Array.from(text);
  let left = 0;
  let right = chars.length;
  while (left < right) {
    const mid = Math.ceil((left + right) / 2);
    if (ctx.measureText(chars.slice(0, mid).join('') + '…').width <= width) left = mid;
    else right = mid - 1;
  }
  return chars.slice(0, left).join('') + '…';
}

function drawIcon(
  ctx: CanvasRenderingContext2D,
  role: ReturnType<typeof elementRole>,
  x: number,
  y: number,
  size: number,
  accent: string,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 16, size / 16);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  switch (role) {
    case 'actor':
      ctx.arc(8, 5, 2.5, 0, Math.PI * 2);
      ctx.moveTo(3, 14);
      ctx.bezierCurveTo(3, 8, 13, 8, 13, 14);
      break;
    case 'database':
      ctx.ellipse(8, 4, 5.5, 2.3, 0, 0, Math.PI * 2);
      ctx.moveTo(2.5, 4);
      ctx.lineTo(2.5, 11.5);
      ctx.ellipse(8, 11.5, 5.5, 2.4, 0, Math.PI, 0, true);
      ctx.lineTo(13.5, 4);
      ctx.moveTo(2.5, 7.6);
      ctx.ellipse(8, 7.6, 5.5, 2.3, 0, Math.PI, 0, true);
      break;
    case 'queue':
      for (const y of [3, 8, 13]) {
        ctx.moveTo(2, y);
        ctx.lineTo(14, y);
        ctx.moveTo(10, y - 2);
        ctx.lineTo(14, y);
        ctx.lineTo(10, y + 2);
      }
      break;
    case 'module':
      ctx.rect(3, 3, 10, 10);
      ctx.moveTo(8, 3);
      ctx.lineTo(8, 13);
      ctx.moveTo(3, 8);
      ctx.lineTo(8, 8);
      break;
    case 'web':
      ctx.roundRect(2, 3, 12, 9, 1.5);
      ctx.moveTo(6, 14);
      ctx.lineTo(10, 14);
      break;
    default:
      ctx.moveTo(2, 6);
      ctx.lineTo(8, 2);
      ctx.lineTo(14, 6);
      ctx.lineTo(14, 13);
      ctx.lineTo(2, 13);
      ctx.closePath();
      ctx.moveTo(6, 13);
      ctx.lineTo(6, 8);
      ctx.lineTo(10, 8);
      ctx.lineTo(10, 13);
  }
  ctx.stroke();
  ctx.restore();
}

function textLines(
  ctx: CanvasRenderingContext2D,
  value: string,
  width: number,
  limit: number,
): string[] {
  const text = value.trim().replace(/\s+/g, ' ');
  const measure = (line: string) => ctx.measureText(line).width;
  if (measure(text) <= width) return [text];
  const chars = Array.from(text);
  const split = (at: number) =>
    [chars.slice(0, at).join('').trim(), chars.slice(at).join('').trim()] as const;
  if (limit === 2) {
    let best: readonly [string, string] | undefined;
    let score = Infinity;
    for (let i = 1; i < chars.length; i++) {
      const [first, second] = split(i);
      const a = measure(first);
      if (a > width) break;
      const b = measure(second);
      const wordBreak = chars[i - 1] === ' ' || chars[i] === ' ';
      const breaksWord =
        !wordBreak &&
        /[\p{Script=Latin}\d]/u.test(chars[i - 1]!) &&
        /[\p{Script=Latin}\d]/u.test(chars[i]!);
      const difference = Math.abs(a - b) + (breaksWord ? width : 0);
      if (b <= width && difference < score) {
        best = [first, second];
        score = difference;
      }
    }
    if (best) return [...best];
  }
  if (limit === 1) return [shorten(ctx, text, width)];
  let fit = 1;
  let space = 0;
  while (fit < chars.length && measure(split(fit + 1)[0]) <= width) {
    fit++;
    if (chars[fit - 1] === ' ') space = fit;
  }
  if (space && measure(split(space)[0]) >= width * 0.55) fit = space;
  const [first, rest] = split(fit);
  return [first, ...textLines(ctx, rest, width, limit - 1)];
}

function overlap(a: Rect, b: Rect) {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  return {
    x,
    y,
    width: Math.min(a.x + a.width, b.x + b.width) - x,
    height: Math.min(a.y + a.height, b.y + b.height) - y,
  };
}

function placeIn(rect: Rect, area: Rect): Rect {
  return {
    ...rect,
    x: Math.max(area.x, Math.min(rect.x, area.x + area.width - rect.width)),
    y: Math.max(area.y, Math.min(rect.y, area.y + area.height - rect.height)),
  };
}

export function drawNodeLabels(
  ctx: CanvasRenderingContext2D,
  nodes: SceneNode[],
  faces: SceneNode[],
  theme: Theme,
  area: Rect,
  highlighted?: ReadonlySet<string>,
): Rect[] {
  const labels: Rect[] = [];
  const pois: SceneNode[] = [];
  const allow = (rect: Rect) => !labels.some((other) => intersects(rect, other));

  function draw(entry: SceneNode, external: boolean) {
    const { node, rect, detail, opacity } = entry;
    const { element } = node;
    if (opacity < 0.04 || !intersects(rect, area)) return;
    const role = elementRole(element);
    const accent = theme.roles[role][2];
    const migration = smoothstep(0, 0.43, detail);
    const icon = role !== 'group' && (external || rect.height >= 37) ? 13 : 0;
    const lead = icon ? icon + 5 : 0;
    const size = external ? 11 : rect.width >= 160 && rect.height >= 64 ? 14 : 11;
    const lineHeight = size + 2;
    const weight = role === 'group' ? 650 : 700;
    setFont(ctx, size, weight);
    const clipped = overlap(rect, area);
    const available = external
      ? Math.min(154, area.width - 24)
      : Math.min(rect.width - 16, area.width - 16, migration >= 1 ? clipped.width - 8 : Infinity);
    if (
      available < lead + 12 ||
      (detail === 0 && !external && (rect.width < 72 || rect.height < 28))
    ) {
      if (!external && !detail) pois.push(entry);
      return;
    }
    const lines = textLines(ctx, element.name, available - lead, 2);
    if (!external && !detail && lines.at(-1)?.endsWith('…')) {
      pois.push(entry);
      return;
    }
    const titleWidth = Math.max(...lines.map((line) => ctx.measureText(line).width)) + lead + 10;
    const titleHeight = lines.length * lineHeight + 6;
    const mid = rect.x + rect.width / 2;
    const centeredWidth = 2 * Math.min(mid - area.x, area.x + area.width - mid);
    const metadataWidth = Math.min(rect.width, centeredWidth);
    const showMetadata = !external && detail < 0.28 && metadataWidth >= 130 && rect.height >= 64;
    const tech = element.technology;
    const count = element.childrenIds.length;
    const description = element.description;
    const descAlpha =
      showMetadata && description
        ? smoothstep(150, 188, rect.width) * smoothstep(78, 105, rect.height)
        : 0;
    let descriptionLines: string[] = [];
    if (descAlpha > 0) {
      setFont(ctx, 11, 500);
      descriptionLines = textLines(
        ctx,
        description!,
        Math.min(340, metadataWidth - 30),
        rect.height >= 118 ? 3 : 2,
      );
    }
    const subtitle = showMetadata && (tech || (count ? `${count} 内部要素` : undefined));
    const metaHeight =
      (subtitle ? 17 : 0) +
      (descriptionLines.length ? (descriptionLines.length * 13 + 4) * descAlpha : 0);
    const centerY = rect.y + (rect.height - titleHeight - metaHeight) / 2;
    let title = {
      x: (mid - titleWidth / 2) * (1 - migration) + (rect.x + 8) * migration,
      y: centerY * (1 - migration) + (rect.y + 6) * migration,
      width: titleWidth,
      height: titleHeight,
    };
    const baseY = title.y;
    if (
      !external &&
      !detail &&
      (!contains(area, title) ||
        !contains(area, { x: title.x + title.width, y: title.y + title.height }))
    ) {
      pois.push(entry);
      return;
    }

    if (external) {
      const candidates: Rect[] = [];
      for (const offset of [5, 24, 46, 68]) {
        for (const shift of [0, -titleWidth * 0.55, titleWidth * 0.55]) {
          const x = mid - titleWidth / 2 + shift;
          candidates.push({ ...title, x, y: rect.y + rect.height + offset });
          candidates.push({ ...title, x, y: rect.y - titleHeight - offset });
        }
      }
      const placed = candidates
        .map((item) => placeIn(item, area))
        .find((item) => allow(item) && !faces.some((face) => intersects(face.rect, item)));
      if (!placed) return;
      title = placed;
    } else if (detail >= 0.7 && clipped.width >= title.width && clipped.height >= title.height) {
      const sticky = placeIn(title, clipped);
      const nextRow = { ...sticky, y: sticky.y + title.height + 4 };
      if (
        intersects(sticky, area) &&
        (allow(sticky) ||
          (nextRow.y + nextRow.height <= clipped.y + clipped.height && allow(nextRow)))
      ) {
        title = allow(sticky) ? sticky : nextRow;
      } else return;
    } else if (!intersects(title, area) || titleHeight > rect.height + 2 || !allow(title)) {
      if (!detail) pois.push(entry);
      return;
    }

    ctx.save();
    ctx.globalAlpha = opacity * (highlighted && !highlighted.has(element.id) ? 0.28 : 1);
    ctx.textBaseline = 'middle';
    if (external) {
      const fromY = title.y >= rect.y ? rect.y + rect.height : rect.y;
      const toY = title.y >= rect.y ? title.y : title.y + title.height;
      ctx.beginPath();
      ctx.moveTo(mid, fromY);
      ctx.lineTo(Math.max(title.x + 6, Math.min(mid, title.x + title.width - 6)), toY);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    if (external || migration > 0.15) {
      roundedRect(ctx, title, 6);
      ctx.fillStyle = theme.surface;
      ctx.fill();
      if (external) {
        ctx.strokeStyle = theme.roles[role][1];
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    if (icon) drawIcon(ctx, role, title.x + 5, title.y + (title.height - icon) / 2, icon, accent);
    ctx.fillStyle = role === 'group' ? accent : theme.ink;
    setFont(ctx, size, weight);
    for (const [i, line] of lines.entries()) {
      ctx.fillText(
        line,
        title.x +
          5 +
          lead +
          (migration || external ? 0 : (title.width - 10 - lead - ctx.measureText(line).width) / 2),
        title.y + 3 + (i + 0.5) * lineHeight,
      );
    }
    let nextY = baseY + titleHeight;
    let blockWidth = 0;
    if (subtitle) {
      setFont(ctx, 10, 600);
      const text = shorten(ctx, subtitle, Math.min(260, metadataWidth - 28));
      const width = ctx.measureText(text).width + 12;
      blockWidth = Math.max(blockWidth, width);
      roundedRect(ctx, { x: mid - width / 2, y: nextY + 1, width, height: 15 }, 5);
      ctx.fillStyle = theme.gridMajor;
      ctx.fill();
      ctx.fillStyle = theme.muted;
      ctx.textAlign = 'center';
      ctx.fillText(text, mid, nextY + 8);
      nextY += 17;
    }
    if (descriptionLines.length) {
      ctx.globalAlpha *= descAlpha;
      setFont(ctx, 11);
      ctx.fillStyle = theme.muted;
      ctx.textAlign = 'center';
      for (const [i, line] of descriptionLines.entries()) {
        ctx.fillText(line, mid, nextY + 8 + i * 13);
        blockWidth = Math.max(blockWidth, ctx.measureText(line).width);
      }
      nextY += descriptionLines.length * 13 + 2;
    }
    ctx.restore();
    entry.labelBounds = title;
    labels.push(
      subtitle || descriptionLines.length
        ? union(title, {
            x: mid - blockWidth / 2,
            y: baseY + titleHeight,
            width: blockWidth,
            height: nextY - baseY - titleHeight,
          })
        : title,
    );
  }

  for (const entry of nodes) {
    entry.labelBounds = undefined;
    draw(entry, false);
  }
  pois.sort(
    (a, b) =>
      Number(!!highlighted?.has(b.node.element.id)) -
        Number(!!highlighted?.has(a.node.element.id)) ||
      a.node.element.level - b.node.element.level,
  );
  for (const entry of pois) draw(entry, true);
  return labels;
}
