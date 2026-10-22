"""Build the static data the site searches over.

Runs the same ingestion as RAG_pipeline.ipynb (PyPDFLoader, 500/50
recursive chunking, all-MiniLM-L6-v2) and writes, into site/public/data/:

  chunks.json      every chunk: page and text
  embeddings.bin   the chunk vectors, float32, row-major (n x 384), L2-normalised
  map.json         a 2-D PCA projection of the vectors, for the scatter plot,
                   plus the projection basis
  questions.json   the suggested questions with their vectors, so they
                   search instantly without loading the model in the browser

Usage (from the repo root):  python site/scripts/build_data.py
"""

import json
from pathlib import Path

import numpy as np
from langchain_community.document_loaders.pdf import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

ROOT = Path(__file__).resolve().parents[2]
PDFS = ROOT / "data" / "pdfs"
OUT = ROOT / "site" / "public" / "data"

QUESTIONS = [
    "What are the differences between naive RAG and advanced RAG?",
    "How is RAG evaluated?",
    "What is query rewriting?",
    "How does chunk size affect retrieval?",
    "What are the limitations of fine-tuning compared to RAG?",
    "How are you doing?",
]


def embedder():
    """all-MiniLM-L6-v2 via sentence-transformers, as in the notebook; falls
    back to Chroma's ONNX export of the same model where torch isn't installed."""
    try:
        from sentence_transformers import SentenceTransformer

        model = SentenceTransformer("all-MiniLM-L6-v2")
        return lambda texts: model.encode(texts, normalize_embeddings=True)
    except ImportError:
        from chromadb.utils.embedding_functions import DefaultEmbeddingFunction

        ef = DefaultEmbeddingFunction()
        return lambda texts: np.array(ef(texts))


def main():
    pages = []
    for pdf in sorted(PDFS.glob("*.pdf")):
        pages.extend(PyPDFLoader(str(pdf)).load())
    chunks = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50).split_documents(pages)

    embed = embedder()
    vectors = np.asarray(embed([c.page_content for c in chunks]), dtype=np.float32)
    vectors /= np.linalg.norm(vectors, axis=1, keepdims=True)
    questions = np.asarray(embed(QUESTIONS), dtype=np.float32)
    questions /= np.linalg.norm(questions, axis=1, keepdims=True)

    # PCA to 2-D for display only; every similarity on the site is computed
    # in the full 384 dimensions.
    mean = vectors.mean(axis=0)
    _, _, vt = np.linalg.svd(vectors - mean, full_matrices=False)
    axes = vt[:2]
    points = (vectors - mean) @ axes.T
    lo, hi = points.min(axis=0), points.max(axis=0)
    scale = lambda p: ((p - lo) / (hi - lo)).round(4).tolist()

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "chunks.json").write_text(
        json.dumps(
            {
                "source": [p.name for p in sorted(PDFS.glob("*.pdf"))],
                "pages": len(pages),
                "dims": int(vectors.shape[1]),
                "chunks": [{"page": c.metadata["page"] + 1, "text": c.page_content} for c in chunks],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    vectors.tofile(OUT / "embeddings.bin")
    (OUT / "map.json").write_text(
        json.dumps(
            {
                "points": scale(points),
                # The projection itself, so the browser can place a typed question on the map
                "mean": mean.round(6).tolist(),
                "axes": axes.round(6).tolist(),
                "lo": lo.round(6).tolist(),
                "hi": hi.round(6).tolist(),
            }
        )
    )
    (OUT / "questions.json").write_text(
        json.dumps(
            [
                {"text": q, "vector": v.round(6).tolist(), "point": scale(((v - mean) @ axes.T)[None])[0]}
                for q, v in zip(QUESTIONS, questions)
            ]
        )
    )

    best = questions @ vectors.T
    print(f"{len(pages)} pages -> {len(chunks)} chunks, {vectors.shape[1]} dims")
    for q, row in zip(QUESTIONS, best):
        print(f"  {row.max():.3f}  {q}")


if __name__ == "__main__":
    main()
