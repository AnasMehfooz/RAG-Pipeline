import {useEffect, useRef, useState, type FormEvent} from 'react';
import {demo} from '../content';
import {useReveals} from '../hooks/useReveals';
import {CONTEXT_K, SYSTEM_PROMPT, THRESHOLD, embed, flatten, loadIndex, project, similarities, topHits, userMessage, type Hit, type Index, type Point} from '../lib/data';
import {INK, SIGNAL, drawQuery, fitCanvas, heat, mapArea, toCanvas} from '../lib/map';

type Result = {query: string; scores: Float32Array; hits: Hit[]; point: Point};
type Status = {kind: 'idle'} | {kind: 'loading'; progress: number} | {kind: 'error'};

/** The map again, coloured by similarity to the current question. Redrawn when the result changes, not on scroll. */
function ResultMap({index, result}: {index: Index; result: Result}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const dpr = fitCanvas(canvas, w, h);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const area = mapArea(w, h);
      const q = toCanvas(area, result.point);
      const context = result.hits.filter((hit, i) => i < CONTEXT_K && hit.score >= THRESHOLD);
      ctx.lineWidth = 1.75;
      for (const hit of context) {
        const [x, y] = toCanvas(area, index.points[hit.index]);
        ctx.strokeStyle = `rgba(${SIGNAL}, 0.9)`;
        ctx.beginPath();
        ctx.moveTo(q[0], q[1]);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      index.points.forEach((pt, i) => {
        const [x, y] = toCanvas(area, pt);
        const s = result.scores[i];
        ctx.fillStyle = s >= THRESHOLD ? `rgba(${SIGNAL}, ${0.35 + 0.65 * heat(s)})` : `rgba(${INK}, ${0.1 + 0.6 * heat(s)})`;
        ctx.beginPath();
        ctx.arc(x, y, 2.75, 0, Math.PI * 2);
        ctx.fill();
      });
      drawQuery(ctx, q);
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [index, result]);
  return <canvas ref={ref} aria-hidden="true" className="size-full" />;
}

export function Demo() {
  const ref = useReveals<HTMLElement>();
  const [index, setIndex] = useState<Index | null>(null);
  const [input, setInput] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [status, setStatus] = useState<Status>({kind: 'idle'});
  const latest = useRef(0);

  const run = (index: Index, query: string, vector: ArrayLike<number>) => {
    const scores = similarities(index, vector);
    setResult({query, scores, hits: topHits(index, scores), point: project(index, vector)});
  };

  useEffect(() => {
    loadIndex().then((idx) => {
      setIndex(idx);
      run(idx, idx.questions[0].text, idx.questions[0].vector);
    });
  }, []);

  const ask = async (query: string) => {
    if (!index || !query.trim()) return;
    const ticket = ++latest.current;
    // Suggested questions carry precomputed vectors and answer instantly.
    const known = index.questions.find((q) => q.text === query);
    if (known) {
      setStatus({kind: 'idle'});
      run(index, known.text, known.vector);
      return;
    }
    setStatus({kind: 'loading', progress: 0});
    try {
      const vector = await embed(query, (progress) => {
        if (ticket === latest.current) setStatus({kind: 'loading', progress});
      });
      if (ticket !== latest.current) return;
      setStatus({kind: 'idle'});
      run(index, query.trim(), vector);
    } catch {
      if (ticket === latest.current) setStatus({kind: 'error'});
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void ask(input);
  };

  const context = result ? result.hits.filter((h, i) => i < CONTEXT_K && h.score >= THRESHOLD) : [];

  return (
    <section ref={ref} id="try" aria-labelledby="try-title" className="border-t border-rule bg-paper px-4 py-24 sm:px-6 md:px-[5vw] md:py-36">
      <div className="grid gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-16">
        <div data-reveal>
          <p className="font-mono text-label text-signal uppercase">{demo.eyebrow}</p>
          <h2 id="try-title" className="mt-4 font-display text-display">
            {demo.heading}
          </h2>
          <p className="mt-5 max-w-[32rem] text-body text-muted">{demo.body}</p>

          <form onSubmit={onSubmit} className="mt-8 flex gap-2" role="search">
            <label htmlFor="question" className="sr-only">
              Question
            </label>
            <input
              id="question"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={demo.placeholder}
              autoComplete="off"
              className="min-w-0 flex-1 border border-rule bg-sheet px-4 py-3 text-body text-ink outline-none placeholder:text-muted/60 focus:border-ink"
            />
            <button type="submit" className="shrink-0 bg-ink px-5 font-mono text-label text-sheet uppercase transition-colors hover:bg-signal disabled:opacity-40" disabled={!index || status.kind === 'loading'}>
              Search
            </button>
          </form>

          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Suggested questions">
            {index?.questions.map((q) => (
              <li key={q.text}>
                <button
                  type="button"
                  onClick={() => {
                    setInput(q.text);
                    void ask(q.text);
                  }}
                  aria-pressed={result?.query === q.text}
                  className="border border-rule px-3 py-1.5 text-left text-[0.8125rem] text-muted transition-colors hover:border-ink hover:text-ink aria-pressed:border-signal aria-pressed:text-signal"
                >
                  {q.text}
                </button>
              </li>
            ))}
          </ul>

          <p role="status" className="mt-4 min-h-[1.25rem] font-mono text-[0.75rem] text-muted">
            {status.kind === 'loading' && `${demo.loading} ${Math.round(status.progress)}%`}
            {status.kind === 'error' && 'The embedding model couldn’t load here. The suggested questions still work.'}
          </p>

          <div className="mt-6 aspect-[4/3] border border-rule bg-sheet max-md:hidden">{index && result && <ResultMap index={index} result={result} />}</div>
        </div>

        <div data-reveal aria-live="polite">
          {result && (
            <>
              <p className="font-mono text-label text-muted uppercase">
                Closest chunks to <span className="text-ink normal-case">“{result.query}”</span>
              </p>
              <ol className="mt-5 divide-y divide-rule border-y border-rule">
                {result.hits.map((h, i) => {
                  const sent = i < CONTEXT_K && h.score >= THRESHOLD;
                  return (
                    <li key={h.index} className={`grid grid-cols-[4.5rem_1fr] gap-4 py-4 ${h.score >= THRESHOLD ? '' : 'opacity-55'}`}>
                      <div className="font-mono text-[0.75rem]">
                        <p className={`tabular-nums ${h.score >= THRESHOLD ? 'text-signal' : 'text-muted'}`}>{h.score.toFixed(3)}</p>
                        <p className="mt-1 text-muted">p. {h.page}</p>
                      </div>
                      <div>
                        <p className="line-clamp-4 text-[0.875rem] leading-relaxed text-ink">{flatten(h.text)}</p>
                        <p className="mt-2 font-mono text-[0.6875rem] tracking-[0.08em] text-muted uppercase">
                          {sent ? '→ sent to the LLM as context' : h.score >= THRESHOLD ? 'above 0.5, outside the top 3' : 'below 0.5, dropped'}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>

              {context.length === 0 ? (
                <div className="mt-6 border-l-2 border-ink pl-4">
                  <p className="font-mono text-label text-muted uppercase">Pipeline answer · LLM not called</p>
                  <p className="mt-2 text-lead">{demo.noContext}</p>
                </div>
              ) : (
                <details className="group mt-6 border border-rule bg-sheet">
                  <summary className="cursor-pointer list-none px-4 py-3 font-mono text-label uppercase marker:hidden">
                    <span className="mr-2 inline-block transition-transform group-open:rotate-90">›</span>
                    The prompt the notebook sends ({context.length} {context.length === 1 ? 'chunk' : 'chunks'})
                  </summary>
                  <div className="space-y-3 border-t border-rule px-4 py-4 font-mono text-[0.75rem] leading-relaxed whitespace-pre-wrap">
                    <p>
                      <span className="text-signal">system</span>
                      {'\n'}
                      {SYSTEM_PROMPT}
                    </p>
                    <p>
                      <span className="text-signal">human</span>
                      {'\n'}
                      {userMessage(result.query, context)}
                    </p>
                  </div>
                </details>
              )}
              <p className="mt-4 text-[0.8125rem] text-muted">{demo.answersNote}</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
