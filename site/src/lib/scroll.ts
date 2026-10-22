import Lenis from 'lenis';

/**
 * One rAF loop for the whole page. Lenis advances first, then every
 * scroll-driven component runs in two phases: all subscribers read their
 * geometry, then all of them write styles. Interleaving the two would force
 * a synchronous layout for every read that follows a write. Nothing here
 * goes through React state, so scrolling never re-renders.
 */

/** Runs in the read phase; may return a function to run in the write phase. */
type Tick = (time: number) => (() => void) | void;

const subscribers = new Set<Tick>();
const writes: (() => void)[] = [];
let lenis: Lenis | null = null;

export function startScroll(reducedMotion: boolean): () => void {
  if (!reducedMotion) {
    lenis = new Lenis({lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.9});
  }

  let raf = 0;
  const loop = (time: number) => {
    lenis?.raf(time);
    writes.length = 0;
    for (const read of subscribers) {
      const write = read(time);
      if (write) writes.push(write);
    }
    for (const write of writes) write();
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    lenis?.destroy();
    lenis = null;
  };
}

export function onFrame(fn: Tick): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

/** Smooth-scrolls to an in-page hash like `#services`, or to the top for `#top`. */
export function scrollToHash(hash: string) {
  const target = hash === '#top' ? 0 : document.querySelector<HTMLElement>(hash);
  if (target === null) return;
  if (lenis) {
    lenis.scrollTo(target, {duration: 1.6});
  } else if (typeof target === 'number') {
    window.scrollTo({top: target});
  } else {
    target.scrollIntoView();
  }
  history.replaceState(null, '', hash === '#top' ? ' ' : hash);
}
