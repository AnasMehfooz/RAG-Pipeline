/**
 * Every word on the page. Numbers that come from the data (pages, chunks,
 * scores) are read from public/data at runtime instead of being typed here.
 */

export const links = {
  repo: 'https://github.com/AnasMehfooz/RAG-Pipeline',
  notebook: 'https://github.com/AnasMehfooz/RAG-Pipeline/blob/main/RAG_pipeline.ipynb',
  profile: 'https://github.com/AnasMehfooz',
};

export const author = {
  name: 'Anas Mehfooz',
  role: 'Computer Science student at IU International University of Applied Sciences',
  seeking: 'Looking for a working-student or internship role in software or data engineering around Cologne and Düsseldorf.',
};

export const hero = {
  eyebrow: 'RAG pipeline · Python, LangChain, ChromaDB',
  // The middle part is kept on one line, so the headline never wraps at “21-”.
  title: ['Ask a', '21-page paper', 'a question.'],
  lede: 'A retrieval-augmented generation pipeline that answers only from the document, cites its pages, and says so when the answer isn’t there.',
  scroll: 'Scroll to run the pipeline',
};

/** The pinned walkthrough, one entry per beat. */
export const beats = [
  {
    step: '01',
    title: 'Chunk',
    body: 'PyPDFLoader reads the paper page by page. A recursive splitter cuts every page into chunks of at most 500 characters, overlapping by 50 so no sentence is lost at a boundary.',
  },
  {
    step: '02',
    title: 'Embed',
    body: 'all-MiniLM-L6-v2 turns each chunk into 384 numbers. Chunks about the same thing land close together. ChromaDB stores them with cosine distance.',
    note: 'The map shows 2 of the 384 dimensions (PCA). Every score on this page is computed in all 384.',
  },
  {
    step: '03',
    title: 'Retrieve',
    body: 'The question is embedded by the same model. Cosine similarity ranks every chunk; the brighter a point, the closer it is to the question.',
  },
  {
    step: '04',
    title: 'Ground',
    body: 'The top three chunks above 0.5 go to the LLM, each tagged with its page. The system prompt allows nothing else: answer from this context, cite the pages.',
  },
  {
    step: '05',
    title: 'Refuse',
    body: 'An off-topic question finds nothing above 0.5. The pipeline answers that the documents don’t cover it and never calls the LLM, so the model can’t fill the gap from memory.',
  },
];

export const demo = {
  eyebrow: 'Try it',
  heading: 'Search the paper yourself.',
  body: 'This runs the retrieval half of the pipeline in your browser: the same model, the same 244 chunks, the same 0.5 cut-off. No API key, and your question never leaves the page.',
  placeholder: 'Ask anything about retrieval-augmented generation',
  loading: 'Loading the embedding model (about 23 MB, once)…',
  noContext: 'I couldn’t find anything about that in the indexed documents.',
  answersNote: 'Answers themselves come from GPT, Llama 3.1 or Claude in the notebook, which needs your own API key.',
};

export const fixes = {
  eyebrow: 'Debugging',
  heading: 'Three bugs I fixed on the way.',
  items: [
    {
      title: 'Answers without evidence',
      before: 'When retrieval found nothing, the LLM was called anyway with an empty context, and answered from its training data.',
      after: 'Below 0.5 the LLM is not called. Above it, the model sees only the retrieved chunks and must cite their pages.',
      code: `if not docs:
    return NO_CONTEXT_ANSWER
return response_text(llm.invoke(build_messages(query, docs)))`,
    },
    {
      title: 'Every re-run doubled the index',
      before: 'Chunks got a random uuid4 id on each ingestion run, so re-running the cell stored every chunk again and top-k filled with duplicates.',
      after: 'Ids are a hash of source, page and content, written with upsert. 244 chunks stay 244.',
      code: `key = f"{source}|{page}|{index}|{doc.page_content}"
ids.append("doc_" + hashlib.sha1(key.encode()).hexdigest())
self.collection.upsert(ids=ids, ...)`,
    },
    {
      title: 'Claude’s thinking leaked into answers',
      before: 'Claude returns a list of content blocks. The raw list, thinking signature included, was printed as the answer.',
      after: 'Only text blocks are kept, so all three providers return plain text.',
      code: `return "".join(b.get("text", "") for b in content
               if b.get("type") == "text")`,
    },
  ],
};

export const stack = {
  eyebrow: 'Stack',
  heading: 'What it’s built with.',
  items: [
    {label: 'Ingestion', value: 'LangChain · PyPDFLoader · RecursiveCharacterTextSplitter'},
    {label: 'Embeddings', value: 'sentence-transformers · all-MiniLM-L6-v2 · PyTorch on an RTX 5060 Ti'},
    {label: 'Vector store', value: 'ChromaDB, persistent, cosine distance'},
    {label: 'Generation', value: 'OpenAI gpt-5.4 · Groq llama-3.1-8b-instant · Anthropic claude-fable-5'},
    {label: 'This page', value: 'React · TypeScript · transformers.js (ONNX, in-browser) · Canvas'},
  ],
};
