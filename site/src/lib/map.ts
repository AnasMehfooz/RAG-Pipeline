import type {Point} from './data';

/** Canvas colours, matching the theme tokens in index.css. */
export const INK = '22, 22, 26';
export const SIGNAL = '217, 72, 15';
export const SHEET = '#fbf9f4';
export const RULE = '#d6cfbf';

export type Rect = {x: number; y: number; w: number; h: number};

/** Maps the 0–1 projection into a canvas area, leaving room for the dots at the edges. */
export function mapArea(w: number, h: number, pad = 0.08): Rect {
  return {x: w * pad, y: h * pad, w: w * (1 - pad * 2), h: h * (1 - pad * 2)};
}

export const toCanvas = (area: Rect, p: Point): Point => [area.x + p[0] * area.w, area.y + (1 - p[1]) * area.h];

/** Brightness of a chunk for a question: off-topic chunks fade back, close ones come forward. */
export const heat = (score: number) => Math.min(1, Math.max(0, (score - 0.1) / 0.7));

/** Sizes a canvas to its CSS box at the device pixel ratio (capped at 2). */
export function fitCanvas(canvas: HTMLCanvasElement, w: number, h: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  return dpr;
}

export function drawQuery(ctx: CanvasRenderingContext2D, [x, y]: Point, scale = 1) {
  if (scale <= 0) return;
  ctx.fillStyle = `rgba(${SIGNAL}, 0.16)`;
  ctx.beginPath();
  ctx.arc(x, y, 16 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgb(${SIGNAL})`;
  ctx.beginPath();
  ctx.arc(x, y, 5.5 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = SHEET;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
