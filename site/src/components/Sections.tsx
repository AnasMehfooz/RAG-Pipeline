import {author, fixes, links, stack} from '../content';
import {useReveals} from '../hooks/useReveals';
import {scrollToHash} from '../lib/scroll';

export function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-rule/70 bg-paper/85 backdrop-blur-md">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6 md:px-[5vw]">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            scrollToHash('#top');
          }}
          className="font-display text-[1.375rem] leading-none"
          aria-label={`${author.name} — back to top`}
        >
          {author.name}
        </a>
        <nav aria-label="Primary" className="flex items-center gap-5 font-mono text-label uppercase md:gap-8">
          <a
            href="#try"
            onClick={(e) => {
              e.preventDefault();
              scrollToHash('#try');
            }}
            className="text-muted transition-colors hover:text-ink max-sm:hidden"
          >
            Try it
          </a>
          <a href={links.repo} className="bg-ink px-3 py-2 text-sheet transition-colors hover:bg-signal">
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}

export function Fixes() {
  const ref = useReveals<HTMLElement>();
  return (
    <section ref={ref} aria-labelledby="fixes-title" className="border-t border-rule bg-paper-2 px-4 py-24 sm:px-6 md:px-[5vw] md:py-36">
      <div data-reveal>
        <p className="font-mono text-label text-signal uppercase">{fixes.eyebrow}</p>
        <h2 id="fixes-title" className="mt-4 font-display text-display">
          {fixes.heading}
        </h2>
      </div>
      <ol className="mt-12 grid gap-4 md:mt-16 md:grid-cols-3 md:gap-5">
        {fixes.items.map((f, i) => (
          <li key={f.title} data-reveal style={{transitionDelay: `${i * 100}ms`}} className="flex min-w-0 flex-col border border-rule bg-sheet p-6 md:p-7">
            <p className="font-mono text-label text-muted">0{i + 1}</p>
            <h3 className="mt-3 font-display text-[1.75rem] leading-tight">{f.title}</h3>
            <dl className="mt-5 space-y-4 text-[0.9375rem] leading-relaxed">
              <div>
                <dt className="font-mono text-label text-muted uppercase">Before</dt>
                <dd className="mt-1.5 text-muted">{f.before}</dd>
              </div>
              <div>
                <dt className="font-mono text-label text-signal uppercase">After</dt>
                <dd className="mt-1.5">{f.after}</dd>
              </div>
            </dl>
            <pre className="mt-auto overflow-x-auto border-t border-rule pt-5 font-mono text-[0.6875rem] leading-relaxed text-ink/80">
              <code>{f.code}</code>
            </pre>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Stack() {
  const ref = useReveals<HTMLElement>();
  return (
    <section ref={ref} aria-labelledby="stack-title" className="border-t border-rule bg-paper px-4 py-24 sm:px-6 md:px-[5vw] md:py-32">
      <div className="grid gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-16">
        <div data-reveal>
          <p className="font-mono text-label text-signal uppercase">{stack.eyebrow}</p>
          <h2 id="stack-title" className="mt-4 font-display text-display">
            {stack.heading}
          </h2>
        </div>
        <dl data-reveal className="divide-y divide-rule border-y border-rule">
          {stack.items.map((s) => (
            <div key={s.label} className="grid gap-1 py-4 md:grid-cols-[10rem_1fr] md:gap-6">
              <dt className="font-mono text-label text-muted uppercase md:pt-1">{s.label}</dt>
              <dd className="text-body">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="bg-ink px-4 py-20 text-sheet sm:px-6 md:px-[5vw] md:py-28">
      <p className="font-mono text-label text-signal uppercase">{author.name}</p>
      <p className="mt-5 max-w-[46rem] font-display text-display">{author.seeking}</p>
      <p className="mt-5 text-body text-sheet/60">{author.role}</p>
      <div className="mt-10 flex flex-wrap gap-3 font-mono text-label uppercase">
        <a href={links.repo} className="bg-sheet px-4 py-3 text-ink transition-colors hover:bg-signal hover:text-sheet">
          The repository
        </a>
        <a href={links.notebook} className="px-4 py-3 ring-1 ring-sheet/30 transition-colors hover:bg-sheet hover:text-ink">
          The notebook
        </a>
        <a href={links.profile} className="px-4 py-3 ring-1 ring-sheet/30 transition-colors hover:bg-sheet hover:text-ink">
          More on GitHub
        </a>
      </div>
    </footer>
  );
}
