import {useEffect, useMemo, useRef, useState} from 'react';
import {beats, hero} from '../content';
import {useReducedMotion} from '../hooks/useReducedMotion';
import {CONTEXT_K, THRESHOLD, flatten, loadIndex, similarities, topHits, type Index} from '../lib/data';
import {INK, RULE, SHEET, SIGNAL, drawQuery, fitCanvas, heat, mapArea, toCanvas} from '../lib/map';
import {clamp, easeInOutCubic, easeOutCubic, lerp, pinProgress, range} from '../lib/math';
import {onFrame} from '../lib/scroll';

/**
 * The pipeline, run on the real data as you scroll. One pinned canvas:
 *
 *   0.00 – 0.10  the title over the paper's 21 pages
 *   0.10 – 0.28  each page splits into its chunks
 *   0.28 – 0.48  the chunks fly to their embedding positions (2-D PCA)
 *   0.48 – 0.66  a question drops in; chunks light up by cosine similarity
 *                and lines reach its five nearest
 *   0.66 – 0.82  the top three above 0.5 become the LLM's context
 *   0.82 – 1.00  an off-topic question: nothing clears 0.5, no LLM call
 */

const STAGE_VH = 760;
/** Caption windows, one per beat in content.ts. */
const WINDOWS: [number, number][] = [
  [0.1, 0.28],
  [0.28, 0.48],
  [0.48, 0.66],
  [0.66, 0.82],
  [0.82, 1.01],
];
const PAGE_ASPECT = 0.72;
/** Which suggested questions the walkthrough uses: an on-topic one, then the off-topic one. */
const ON_TOPIC = 0;
const OFF_TOPIC = 5;

type Layout = {
  w: number;
  h: number;
  pages: {x: number; y: number; w: number; h: number}[];
  strips: {x: number; y: number; w: number; h: number}[];
  dots: [number, number][];
};

/** Pages in the grid that makes them largest, and every chunk as a strip of its page. */
function layout(index: Index, w: number, h: number): Layout {
  const n = index.pages;
  const gap = Math.max(6, w * 0.012);
  let best = {cols: 1, pw: 0};
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const pw = Math.min((w - gap * (cols - 1)) / cols, ((h - gap * (rows - 1)) / rows) * PAGE_ASPECT);
    if (pw > best.pw) best = {cols, pw};
  }
  const {cols, pw} = best;
  const ph = pw / PAGE_ASPECT;
  const rows = Math.ceil(n / cols);
  const ox = (w - (cols * pw + (cols - 1) * gap)) / 2;
  const oy = (h - (rows * ph + (rows - 1) * gap)) / 2;
  const pages = Array.from({length: n}, (_, i) => ({x: ox + (i % cols) * (pw + gap), y: oy + Math.floor(i / cols) * (ph + gap), w: pw, h: ph}));

  const perPage = new Map<number, number[]>();
  index.chunks.forEach((c, i) => perPage.set(c.page, [...(perPage.get(c.page) ?? []), i]));
  const strips: Layout['strips'] = [];
  perPage.forEach((ids, page) => {
    const p = pages[page - 1];
    const inner = {x: p.x + p.w * 0.14, y: p.y + p.h * 0.1, w: p.w * 0.72, h: p.h * 0.8};
    ids.forEach((id, k) => {
      strips[id] = {x: inner.x, y: inner.y + (inner.h / ids.length) * k, w: inner.w, h: inner.h / ids.length};
    });
  });

  const area = mapArea(w, h);
  const dots = index.points.map((pt) => toCanvas(area, pt));
  return {w, h, pages, strips, dots};
}

export function Story() {
  const [index, setIndex] = useState<Index | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const beatRefs = useRef<HTMLDivElement[]>([]);
  const countRef = useRef<HTMLSpanElement>(null);
  const hitRefs = useRef<HTMLLIElement[]>([]);
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  useEffect(() => {
    loadIndex().then(setIndex);
  }, []);

  const walk = useMemo(() => {
    if (!index) return null;
    const on = index.questions[ON_TOPIC];
    const off = index.questions[OFF_TOPIC];
    const onScores = similarities(index, on.vector);
    const offScores = similarities(index, off.vector);
    return {on, off, onScores, offScores, onHits: topHits(index, onScores), offHits: topHits(index, offScores)};
  }, [index]);

  useEffect(() => {
    if (!index || !walk) return;
    const root = rootRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const n = index.chunks.length;

    // Geometry is measured on resize only, never in the frame loop.
    let geo: Layout | null = null;
    let dpr = 1;
    let p = 0;
    let lastP = -1;
    let lastReduced = reducedRef.current;
    let shownCount = -1;
    const measure = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      dpr = fitCanvas(canvas, w, h);
      geo = layout(index, w, h);
      lastP = -1;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(canvas);

    const onQ = toCanvasPoint(walk.on.point);
    const offQ = toCanvasPoint(walk.off.point);
    function toCanvasPoint(pt: [number, number]) {
      return () => toCanvas(mapArea(geo!.w, geo!.h), pt);
    }

    const write = () => {
      const still = reducedRef.current;
      if (Math.abs(p - lastP) < 0.00005 && still === lastReduced) return;
      lastP = p;
      lastReduced = still;
      // Reduced motion: each beat cuts to its end state instead of animating.
      const t = (v: number) => (still ? (v > 0.5 ? 1 : 0) : v);

      const split = t(easeInOutCubic(range(p, 0.12, 0.26)));
      const fly = t(range(p, 0.28, 0.46));
      const ask = t(easeOutCubic(range(p, 0.49, 0.6)));
      const ground = t(easeInOutCubic(range(p, 0.67, 0.76)));
      const refuse = t(easeInOutCubic(range(p, 0.83, 0.92)));

      // --- DOM: title, captions, counters ---------------------------------
      const heroOut = range(p, 0.05, 0.11);
      heroRef.current!.style.opacity = String(1 - heroOut);
      heroRef.current!.style.transform = still ? '' : `translate3d(0, ${-heroOut * 3}rem, 0)`;
      heroRef.current!.style.visibility = heroOut >= 1 ? 'hidden' : '';
      WINDOWS.forEach(([a, b], i) => {
        const v = range(p, a, a + 0.03) * (1 - range(p, b - 0.03, b));
        const el = beatRefs.current[i];
        el.style.opacity = String(v);
        el.style.transform = still ? '' : `translate3d(0, ${(1 - v) * (p < a + 0.03 ? 1.25 : -1.25)}rem, 0)`;
        el.style.visibility = v <= 0 ? 'hidden' : '';
      });
      const count = Math.round(lerp(index.pages, n, split));
      if (count !== shownCount) {
        shownCount = count;
        countRef.current!.textContent = String(count);
      }
      hitRefs.current.forEach((li, i) => {
        li.style.opacity = String(range(ask, 0.2 + i * 0.12, 0.45 + i * 0.12));
      });

      // --- Canvas ----------------------------------------------------------
      const g = geo!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, g.w, g.h);

      // Pages, fading out as their chunks leave.
      const sheet = 1 - clamp(fly * 1.6);
      if (sheet > 0) {
        ctx.globalAlpha = sheet;
        ctx.fillStyle = SHEET;
        ctx.strokeStyle = RULE;
        ctx.lineWidth = 1;
        for (const r of g.pages) {
          ctx.fillRect(r.x, r.y, r.w, r.h);
          ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
        }
        ctx.globalAlpha = 1;
      }

      // Chunks: text-line strips → separated blocks → dots on the map.
      const q = lerpPoint(onQ(), offQ(), refuse);
      for (let i = 0; i < n; i++) {
        const s = g.strips[i];
        // Staggered by page order, so the paper unravels from the first page on.
        const k = still ? fly : easeInOutCubic(clamp(fly * 1.5 - (i / n) * 0.5));

        // Before the split, a chunk's share of the page reads as lines of text.
        if (split < 1 && k === 0) {
          ctx.fillStyle = `rgba(${INK}, ${0.42 * (1 - split)})`;
          const pitch = Math.max(3, Math.min(6, s.h / 3));
          for (let ly = s.y + pitch * 0.4, line = 0; ly + 1.5 <= s.y + s.h; ly += pitch, line++) {
            ctx.fillRect(s.x, ly, s.w * (0.78 + ((i * 7 + line * 13) % 22) / 100), 1.5);
          }
        }
        // After it, each chunk is one block, with a visible cut to the next.
        const gapPx = Math.max(1.5, s.h * 0.28);
        const a = {x: s.x, y: s.y + gapPx / 2, w: s.w, h: Math.max(1, s.h - gapPx)};
        const block = k > 0 ? 1 : split;
        const [dx, dy] = g.dots[i];
        const r = 3;
        const x = lerp(a.x, dx - r, k);
        const y = lerp(a.y, dy - r, k);
        const w = lerp(a.w, r * 2, k);
        const h = lerp(a.h, r * 2, k);

        // Colour by similarity once a question is asked; the walkthrough
        // cross-fades from the on-topic question's heat to the off-topic one's.
        const score = lerp(walk.onScores[i], walk.offScores[i], refuse);
        const lit = ask * heat(score);
        const above = ask * (1 - refuse) * (walk.onScores[i] >= THRESHOLD ? 1 : 0);
        const alpha = lerp(0.62, lerp(0.14, 1, lit), ask) * block;
        if (alpha <= 0) continue;
        ctx.fillStyle = above > 0.5 ? `rgba(${SIGNAL}, ${alpha})` : `rgba(${INK}, ${alpha})`;
        if (k < 0.98) {
          ctx.fillRect(x, y, w, h);
        } else {
          ctx.beginPath();
          ctx.arc(dx, dy, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Lines from the question to its nearest chunks.
      if (ask > 0) {
        const hits = walk.onHits;
        hits.forEach((hit, i) => {
          const draw = clamp(ask * 1.6 - i * 0.12) * (1 - refuse);
          if (draw <= 0) return;
          const [hx, hy] = g.dots[hit.index];
          const context = i < CONTEXT_K && hit.score >= THRESHOLD;
          const width = lerp(1.25, context ? 2.5 : 0.75, ground);
          const alpha = lerp(0.85, context ? 1 : 0.25, ground);
          ctx.strokeStyle = `rgba(${SIGNAL}, ${alpha * draw})`;
          ctx.lineWidth = width;
          ctx.beginPath();
          ctx.moveTo(q[0], q[1]);
          ctx.lineTo(lerp(q[0], hx, draw), lerp(q[1], hy, draw));
          ctx.stroke();
          if (context && ground > 0) {
            ctx.strokeStyle = `rgba(${SIGNAL}, ${ground * (1 - refuse)})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(hx, hy, 9, 0, Math.PI * 2);
            ctx.stroke();
          }
        });
        // The off-topic question's nearest chunks: dashed, because none is close enough.
        if (refuse > 0) {
          ctx.setLineDash([3, 5]);
          ctx.lineWidth = 1;
          walk.offHits.slice(0, CONTEXT_K).forEach((hit) => {
            const [hx, hy] = g.dots[hit.index];
            ctx.strokeStyle = `rgba(${INK}, ${0.45 * refuse})`;
            ctx.beginPath();
            ctx.moveTo(q[0], q[1]);
            ctx.lineTo(hx, hy);
            ctx.stroke();
          });
          ctx.setLineDash([]);
        }
        drawQuery(ctx, q, easeOutCubic(clamp(ask * 2.5)));
      }
    };

    const stop = onFrame(() => {
      const pin = pinProgress(root);
      if (pin.rect.bottom < 0 || pin.rect.top > pin.vh) return;
      p = pin.p;
      return write;
    });

    return () => {
      stop();
      ro.disconnect();
    };
  }, [index, walk]);

  const onTop = walk?.onHits ?? [];
  const context = onTop.filter((h, i) => i < CONTEXT_K && h.score >= THRESHOLD);
  const offBest = walk?.offHits[0];

  return (
    <section ref={rootRef} id="top" aria-label="How the pipeline works" className="relative" style={{height: `${STAGE_VH}svh`}}>
      <div className="sticky top-0 grid h-screen-s grid-rows-[minmax(0,44%)_minmax(0,1fr)] overflow-hidden px-4 pt-16 pb-4 sm:px-6 md:grid-cols-[minmax(20rem,36%)_1fr] md:grid-rows-1 md:gap-10 md:px-[5vw] md:pt-20 md:pb-8">
        <div className="relative min-h-0">
          {/* Title, before the first beat. */}
          <div ref={heroRef} className="absolute inset-0 flex flex-col justify-center">
            <p className="font-mono text-label text-signal uppercase">{hero.eyebrow}</p>
            <h1 className="mt-4 font-display text-hero text-ink md:mt-6">
              {hero.title[0]} <span className="whitespace-nowrap">{hero.title[1]}</span> <em className="text-signal">{hero.title[2]}</em>
            </h1>
            <p className="mt-5 max-w-[30rem] text-lead text-muted max-md:hidden">{hero.lede}</p>
            <p className="mt-6 flex items-center gap-2 font-mono text-label text-muted uppercase md:mt-10">
              {hero.scroll}
              <span aria-hidden="true" className="inline-block animate-bounce motion-reduce:animate-none">
                ↓
              </span>
            </p>
          </div>

          {/* One caption per beat, stacked; the scroll decides which is visible. */}
          {beats.map((b, i) => (
            <div
              key={b.step}
              ref={(el) => {
                if (el) beatRefs.current[i] = el;
              }}
              className="absolute inset-0 flex flex-col justify-center"
              style={{opacity: 0, visibility: 'hidden'}}
            >
              <p className="font-mono text-label text-signal uppercase">
                {b.step} · {b.title}
              </p>
              <h2 className="mt-3 font-display text-display">
                {i === 0 && (
                  <>
                    {index?.pages ?? 21} pages → <span ref={countRef}>{index?.pages ?? 21}</span> chunks
                  </>
                )}
                {i === 1 && `${index?.chunks.length ?? 244} points in 384 dimensions`}
                {i === 2 && <span className="text-signal">“{walk?.on.text}”</span>}
                {i === 3 && `Top ${context.length}, with their pages`}
                {i === 4 && <span className="text-signal">“{walk?.off.text}”</span>}
              </h2>
              <p className="mt-3 max-w-[34rem] text-body text-muted md:mt-4">{b.body}</p>
              {i === 1 && 'note' in b && <p className="mt-3 max-w-[34rem] font-mono text-[0.75rem] leading-relaxed text-muted/80 max-md:hidden">{b.note}</p>}

              {i === 2 && (
                <ol className="mt-4 space-y-1.5 font-mono text-[0.75rem] max-md:hidden" aria-label="Five closest chunks">
                  {onTop.map((h, k) => (
                    <li
                      key={h.index}
                      ref={(el) => {
                        if (el) hitRefs.current[k] = el;
                      }}
                      className="flex items-center gap-3"
                      style={{opacity: 0}}
                    >
                      <span className="w-12 tabular-nums">{h.score.toFixed(3)}</span>
                      <span className="relative h-1 flex-1 bg-rule">
                        <span className={`absolute inset-y-0 left-0 ${h.score >= THRESHOLD ? 'bg-signal' : 'bg-muted'}`} style={{width: `${h.score * 100}%`}} />
                        <span className="absolute -inset-y-1 left-1/2 w-px bg-ink" title="0.5 threshold" />
                      </span>
                      <span className="w-10 text-right text-muted">p. {h.page}</span>
                    </li>
                  ))}
                </ol>
              )}

              {i === 3 && (
                <div className="mt-4 space-y-2 border-l-2 border-signal pl-4 font-mono text-[0.75rem] leading-relaxed text-muted max-md:hidden">
                  <p className="text-ink">Use only the context. Cite the pages you used, like [p. 4].</p>
                  {context.map((h) => (
                    <p key={h.index} className="line-clamp-2">
                      <span className="text-signal">[p. {h.page}]</span> {flatten(h.text)}
                    </p>
                  ))}
                </div>
              )}

              {i === 4 && offBest && (
                <div className="mt-4 font-mono text-[0.75rem] leading-relaxed">
                  <p className="text-muted">
                    Best match {offBest.score.toFixed(3)} &lt; {THRESHOLD} · LLM not called
                  </p>
                  <p className="mt-2 border-l-2 border-ink pl-4 text-ink">I couldn’t find anything about that in the indexed documents.</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="relative min-h-0">
          <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 size-full" />
        </div>
      </div>
    </section>
  );
}

const lerpPoint = (a: [number, number], b: [number, number], t: number): [number, number] => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
