# Multimodal RAG Chatbot

An end-to-end Multimodal Retrieval-Augmented Generation (RAG) chatbot built with Next.js, Groq, Qdrant Cloud, Hugging Face Transformers.js, Tavily Search, and OCR.space.

## Key Features

- **Multimodal Document Ingestion**: Ingest raw text or images (with automated OCR text extraction via OCR.space).
- **Text Chunking**: Configurable chunk sizes with token/character overlap for optimal context preservation.
- **Local Hugging Face Embeddings**: Zero cloud inference costs using `@huggingface/transformers` (`all-MiniLM-L6-v2`) via ONNX Runtime.
- **Vector Storage**: Scalable cloud vector indexing and semantic cosine similarity search powered by Qdrant.
- **Hybrid Context Retrieval**: Combines localized document chunks with live web search results from Tavily.
- **Fast LLM Generation**: Real-time streaming generation powered by Groq.

## Documentation

- **[Prompt Documentation](file:///e:/MultiRagChatbot-main/PROMPT_DOCUMENTATION.md)**: Detailed log of prompts, architectural decisions, and iterative troubleshooting sessions used during the development of this project.

## Getting Started

### 1. Environment Setup

Create or update `.env` in the root directory:

```env
GROQ_API_KEY=your_groq_api_key
QDRANT_URL=your_qdrant_cluster_url
QDRANT_API_KEY=your_qdrant_api_key
OCR_API_KEY=your_ocr_space_api_key
TAVILY_API_KEY=your_tavily_api_key
```

### 2. Run Locally

```powershell
npm run dev
# or in PowerShell: npm.cmd run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
