/**
 * The search index, built by scripts/build_data.py from the same ingestion as
 * the notebook, and the in-browser half of retrieval: cosine similarity over
 * all 384 dimensions, the 0.5 cut-off, and the prompt the notebook would send.
 */

// The runtime transformers.js loads, imported as URLs so Vite serves them in
// development and fingerprints them in the build. onnxruntime-web is pinned in
// package.json to the version transformers.js 3.7.6 requires, which keeps it at
// the top of node_modules; its package exports don't expose these files.
import ortMjs from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs?url';
import ortWasm from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm?url';

export const DIMS = 384;
export const THRESHOLD = 0.5;
export const TOP_K = 5;
/** generate_output() in the notebook sends the top 3 chunks to the LLM. */
export const CONTEXT_K = 3;

export type Chunk = {page: number; text: string};
export type Point = [number, number];
export type Question = {text: string; vector: number[]; point: Point};
export type Hit = {index: number; score: number; page: number; text: string};

export type Index = {
  source: string[];
  pages: number;
  chunks: Chunk[];
  vectors: Float32Array;
  points: Point[];
  questions: Question[];
  projection: {mean: number[]; axes: [number[], number[]]; lo: Point; hi: Point};
};

const url = (file: string) => `${import.meta.env.BASE_URL}data/${file}`;

let loading: Promise<Index> | null = null;

export function loadIndex(): Promise<Index> {
  loading ??= (async () => {
    const [chunks, vectors, map, questions] = await Promise.all([
      fetch(url('chunks.json')).then((r) => r.json()),
      fetch(url('embeddings.bin')).then((r) => r.arrayBuffer()),
      fetch(url('map.json')).then((r) => r.json()),
      fetch(url('questions.json')).then((r) => r.json()),
    ]);
    return {
      source: chunks.source,
      pages: chunks.pages,
      chunks: chunks.chunks,
      vectors: new Float32Array(vectors),
      points: map.points,
      questions,
      projection: {mean: map.mean, axes: map.axes, lo: map.lo, hi: map.hi},
    };
  })();
  return loading;
}

/** Similarity of the query to every chunk. Both sides are L2-normalised, so the dot product is the cosine. */
export function similarities(index: Index, query: ArrayLike<number>): Float32Array {
  const n = index.chunks.length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let dot = 0;
    const row = i * DIMS;
    for (let d = 0; d < DIMS; d++) dot += index.vectors[row + d] * query[d];
    out[i] = dot;
  }
  return out;
}

export function topHits(index: Index, scores: Float32Array, k = TOP_K): Hit[] {
  return Array.from(scores, (score, i) => ({score, i}))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(({score, i}) => ({index: i, score, page: index.chunks[i].page, text: index.chunks[i].text}));
}

/** Where a vector falls on the 2-D map, in the same 0–1 space as the chunk points. */
export function project(index: Index, v: ArrayLike<number>): Point {
  const {mean, axes, lo, hi} = index.projection;
  const out: Point = [0, 0];
  for (let a = 0; a < 2; a++) {
    let s = 0;
    for (let d = 0; d < DIMS; d++) s += (v[d] - mean[d]) * axes[a][d];
    out[a] = (s - lo[a]) / (hi[a] - lo[a]);
  }
  return out;
}

/** PDF text keeps the layout's line breaks; for reading, they're just spaces. */
export const flatten = (text: string) => text.replace(/\s+/g, ' ').trim();

/** Mirrors SYSTEM_PROMPT and build_messages() in the notebook. */
export const SYSTEM_PROMPT = `You answer questions about the documents provided as context.
Use only the context. Cite the pages you used, like [p. 4].
If the context does not contain the answer, say that you don't know.`;

export function userMessage(query: string, hits: Hit[]): string {
  const context = hits.map((h) => `[p. ${h.page}] ${h.text}`).join('\n\n');
  return `Context:\n${context}\n\nQuestion: ${query}`;
}

type Extractor = (text: string, options: {pooling: 'mean'; normalize: boolean}) => Promise<{data: Float32Array}>;
let extractor: Promise<Extractor> | null = null;

/**
 * Embeds a question in the browser with the same model the index was built
 * with. transformers.js and the 23 MB model load on first use only.
 */
export function embed(text: string, onProgress?: (loaded: number) => void): Promise<Float32Array> {
  extractor ??= (async () => {
    const {pipeline, env} = await import('@huggingface/transformers');
    // ONNX Runtime from this site rather than transformers.js' default CDN.
    const onnx = env.backends.onnx as {wasm?: {wasmPaths?: {wasm: string; mjs: string}}};
    if (onnx.wasm) onnx.wasm.wasmPaths = {wasm: new URL(ortWasm, location.href).href, mjs: new URL(ortMjs, location.href).href};
    // In development the model can be served from public/models; the
    // published site fetches it from the Hugging Face Hub.
    env.allowLocalModels = import.meta.env.DEV;
    env.localModelPath = `${import.meta.env.BASE_URL}models/`;
    const pipe = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      dtype: 'q8',
      progress_callback: (e: {status: string; progress?: number}) => {
        if (e.status === 'progress' && e.progress !== undefined) onProgress?.(e.progress);
      },
    });
    return pipe as unknown as Extractor;
  })().catch((error) => {
    extractor = null; // let the next question try again
    throw error;
  });
  return extractor.then((run) => run(text, {pooling: 'mean', normalize: true})).then((out) => out.data);
}
