# 🧠 Retrieval-Augmented Generation (RAG) Pipeline

A modular and production-ready **Retrieval-Augmented Generation (RAG)** pipeline powered by **LangChain**, **ChromaDB**, and multi-LLM orchestrations (**OpenAI**, **Groq / Llama 3**, and **Anthropic Claude**).

---

## 🚀 Overview

This repository implements a full end-to-end RAG system that ingests unstructured PDF documents, embeds them into high-dimensional vector representations, indexes them inside a persistent **ChromaDB** vector store, and synthesizes answers using state-of-the-art LLMs with strict source grounding.

`mermaid
flowchart LR
    A[📄 PDF Documents] --> B[✂️ Recursive Chunking]
    B --> C[🧬 Embeddings Model]
    C --> D[(🗄️ ChromaDB Vector Store)]
    E[❓ User Query] --> D
    D -->|Top-K Context Chunks| F[🤖 LLM Reasoning Engine
(OpenAI / Groq / Claude)]
    E --> F
    F --> G[💬 Grounded Answer + Citations]
`

---

## 🌟 Key Features

- **Multi-LLM Integration**: Seamless switching between:
  - **OpenAI** (GPT-4o, GPT-3.5-Turbo)
  - **Groq** (Ultra-fast inference with Llama 3 / Mixtral)
  - **Anthropic** (Claude 3.5 Sonnet / Haiku)
- **Document Preprocessing**: Automated ingestion, text extraction, and token-aware semantic chunking.
- **Persistent Vector Database**: Embedded with ChromaDB for instant vector search and cosine similarity retrieval.
- **Context-Augmented Prompting**: Custom prompt templates designed to eliminate hallucinations by anchoring responses strictly to retrieved source context.

---

## 📁 Repository Structure

`
RAG-Pipeline/
├── data/
│   ├── pdfs/               # Source PDF documents for ingestion
│   ├── vector_store/       # Persistent ChromaDB vector database index
│   └── research2.pdf       # Sample research paper dataset
├── .gitignore              # Ignored checkpoint files and caches
├── RAG_pipeline.ipynb      # Main end-to-end interactive RAG notebook
└── README.md               # Project documentation
`

---

## 🛠️ Quickstart Guide

### 1. Clone the Repository
`ash
git clone https://github.com/AnasMehfooz/RAG-Pipeline.git
cd RAG-Pipeline
`

### 2. Set Up a Virtual Environment
`ash
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate
`

### 3. Install Requirements
`ash
pip install langchain langchain-community langchain-openai langchain-groq langchain-anthropic chromadb pypdf sentence-transformers
`

### 4. Configure Environment Variables
Create a .env file in the root directory (or set your environment variables in your terminal):
`env
OPENAI_API_KEY=your_openai_api_key_here
GROQ_API_KEY=your_groq_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
`

### 5. Run the Pipeline
Launch Jupyter Notebook or Jupyter Lab:
`ash
jupyter lab
`
Open RAG_pipeline.ipynb and run the cells sequentially to build the vector index and execute retrieval queries.

---

## 💡 How It Works

1. **Document Loading**: PyPDF extracts raw text from PDF documents in ./data/.
2. **Text Chunking**: Text is segmented into overlapping chunks (chunk size: 1000, overlap: 200) using RecursiveCharacterTextSplitter.
3. **Embedding Generation**: Chunks are embedded and stored in the local ChromaDB database (./data/vector_store).
4. **Retrieval & Generation**: When a query is submitted, the retriever performs similarity search, retrieves the top matching chunks, and pipes them into the LLM prompt context for grounded generation.

---

## 👤 Author

**Anas Mehfooz**
- GitHub: [@AnasMehfooz](https://github.com/AnasMehfooz)
