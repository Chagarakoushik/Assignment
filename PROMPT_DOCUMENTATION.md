# Prompt Documentation & AI Development Log

**Project:** Multimodal RAG Chatbot  
**Developer:** Chagara Kousik

**Stack:** Next.js 16, TypeScript, Groq, Qdrant Cloud, Hugging Face Transformers.js, Tavily Search, OCR.space  

---

## 1. Introduction & Development Approach

For this project, I wanted to build a practical, multimodal Retrieval-Augmented Generation (RAG) assistant. The goal was to let users upload either text documents or images (with automated OCR), store and retrieve relevant semantic chunks using vector embeddings in Qdrant, and answer user queries with Groq LLMs while having an optional live web-search fallback with Tavily.

Throughout development, I used an AI assistant as a pair programmer. Below is a realistic, step-by-step log of the prompts I used, the follow-up revisions I made when things broke or didn't meet my expectations, and the thought process behind each decision.

---

## 2. Prompts Used During Development

### Step 1: Project Setup & Architecture Scaffolding

#### My Prompt:
> *"Create a Next.js full-stack application using TypeScript and Tailwind CSS for a multimodal RAG chatbot. I want an interface where users can either type text or upload images for OCR extraction, chunk the content, store embeddings in Qdrant, and chat with Groq. Also include an option to toggle Tavily web search."*

#### My Thought Process & Intent:
I wanted to get the foundational boilerplate, folder structure, and UI out of the way quickly so I could focus on the RAG pipeline. Rather than writing multiple disconnected scripts, I asked for the complete flow: UI + API routes (`/api/ingest`, `/api/chat`, `/api/clear`).

#### Outcome & Adjustments:
The initial structure gave me `src/app/page.tsx` with a dual-tab sidebar (text vs. image upload) and chat interface, along with the API routes. However, several dependencies and environmental setups needed fine-tuning, especially when running locally on Windows.

---

### Step 2: Refining the System Prompt for Grounded Responses

#### My Prompt:
> *"Help me craft the system prompt for the Groq chat route. The model needs to prioritize the retrieved context from Qdrant, cleanly incorporate web search results when enabled, and be honest when it doesn't know the answer rather than making things up."*

#### My Thought Process:
Standard LLM responses often hallucinate when the retrieved document chunks don't have enough information. I needed a prompt that gave clear instructions on precedence:
1. Use retrieved context first.
2. If web search is on, look at the web search results.
3. If neither contains the answer, admit it while still being helpful based on the user's question.

#### Prompt Implemented in Code:
```text
You are an intelligent multimodal assistant. 
Use the provided retrieved context to answer the user's question. 
If the context doesn't contain the answer, say so, but still try to be helpful based on the user's current query.
Keep answers concise and well formatted.

RETRIEVED CONTEXT:
${contextText}
```

#### Outcome:
This prompt kept responses concise and grounded in the ingested documents.

---

### Step 3: Debugging the Broken Dev Server & Native Module Crash

#### The Problem:
When I ran `npm run dev`, the server immediately crashed with:
`Attempted to load @next/swc-win32-x64-msvc, but an error occurred: next-swc.win32-x64-msvc.node is not a valid Win32 application.` followed by `Error: turbo.createProject is not supported by the wasm bindings.`

#### My Prompt:
> *"see what is rror"*

#### My Thought Process:
I didn't guess what was wrong—I wanted the AI to inspect the environment, the installed `node_modules`, and the build logs directly. 

#### What Happened & How We Solved It:
- Inspecting the PE binary headers revealed that the `@next/swc-win32-x64-msvc` binary on my disk was only 86 MB, while the actual package on npm is ~128 MB. The file had been truncated during an interrupted `npm install`.
- Running `npm cache clean --force` and cleanly reinstalling `@next/swc-win32-x64-msvc` and `lucide-react` fixed the corrupted files.
- After doing this, TypeScript compilation passed with zero errors and Turbopack booted immediately.

---

### Step 4: Eliminating API Credit Limits with Local Transformers

#### The Problem:
When I tested document ingestion, the backend failed with:
`Error: Failed to perform inference: You have no remaining credits. Purchase pre-paid credits to continue using Inference Providers. Alternatively, subscribe to PRO to get monthly included credits.`

#### My Follow-up Prompt:
> *"Error: Failed to perform inference: You have no remaining credits. Purchase pre-paid credits to continue using Inference Providers. Alternatively, subscribe to PRO to get monthly included credits.*
> 
> *use hugging face transformers instead of this"*

#### My Thought Process:
The remote Hugging Face Inference API was requiring paid credits or a monthly PRO subscription for serverless inference. I didn't want my project to be dependent on paid credit limits or fail unexpectedly during a demo. I knew Hugging Face has **Transformers.js** (`@huggingface/transformers`), which can run embedding models like `all-MiniLM-L6-v2` locally on my CPU via ONNX Runtime without needing any API keys or internet requests for inference.

#### Outcome & Improvements:
- Swapped `@huggingface/inference` for `@huggingface/transformers`.
- Built a singleton pipeline in `src/utils/embedding.ts` that downloads the model weights once and caches them for all subsequent requests.
- Added `serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node"]` in `next.config.ts`.
- **Result:** Embedding generation became 100% free, private, and offline, producing consistent 384-dimensional vectors.

---

### Step 5: Fixing the Qdrant 400 Bad Request Dimension Mismatch

#### The Problem:
After switching to local embeddings, I tried uploading a document again and saw this error in my console:
```text
{"error":"Bad Request"} see why
Split into 10 chunks.
Ingest error: Error: Bad Request
    at async POST (src\app\api\ingest\route.ts:52:13)
```

#### My Prompt:
> *"{"error":"Bad Request"} see why*
> *Split into 10 chunks.*
> *Ingest error: Error: Bad Request*
> *    at async POST (src\app\api\ingest\route.ts:52:13)*
> *  50 |*
> *  51 |         if (points.length > 0) {*
> *> 52 |             await qdrantClient.upsert(COLLECTION_NAME, {*
> *     |             ^*
> *  53 |                 wait: true,*
> *  54 |                 points: points*
> *  55 |             });"*

#### My Thought Process:
Giving the AI the exact line number (`line 52: qdrantClient.upsert`) and the status code (`400 Bad Request`) helped avoid guessing. 

#### What Happened & How We Solved It:
- We queried Qdrant Cloud directly to inspect the existing `multimodal_rag_chatbot` collection config.
- We discovered the collection had been created earlier with vector size **768** (for an older model).
- Our new local `all-MiniLM-L6-v2` model outputs **384** dimensions. Qdrant rejected the points because `384 != 768`.
- We reset the collection to 384 dimensions and updated `ensureCollectionExists()` in `src/utils/qdrant.ts` to automatically check if the remote collection's dimensions match `384`, recreating it if a mismatch is ever detected.

---

### Step 6: Specifying the Chat Model & Handling Deprecations

#### My Prompt:
> *"llama-3.1-8b-instant use this model"*

#### My Thought Process:
I wanted to make sure our Groq completions were using the fast `llama-3.1-8b-instant` model.

#### What Happened & How We Solved It:
- When we tested `llama-3.1-8b-instant` directly against Groq's API, Groq returned:
  `404: The model 'llama-3.1-8b-instant' does not exist or you do not have access to it.`
  Groq had recently deprecated older Llama checkpoints on their free endpoints.
- We queried the list of active models on my Groq key using `groq.models.list()` and confirmed that `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, and `qwen/qwen3.8-27b` were active.
- To make the app resilient, we kept `llama-3.1-8b-instant` as the default (and made it overridable via `GROQ_MODEL` in `.env`), but added an automatic try/catch fallback: if Groq throws a `404` or `model_not_found`, it automatically falls back to `openai/gpt-oss-120b` so the user never encounters a crashed chat.

---

## 3. Reflections on Working with AI Tools

1. **Pasting raw error logs saves time:** Instead of paraphrasing an issue ("it didn't work"), pasting the actual stack trace and line numbers allowed the AI to pinpoint the exact failed function call and query the database schema immediately.
2. **Knowing when to pivot architectures:** When the remote Hugging Face API ran out of free credits, rather than creating new accounts or paying for tokens, recognizing that embeddings could be generated locally via Transformers.js made the application significantly more reliable and completely free to run.
3. **Designing defensive fallbacks:** Third-party cloud APIs (like Groq and Qdrant) change often—models get decommissioned and collection schemas can mismatch. Adding automatic dimension verification and model fallbacks prevented runtime crashes and made the application much more robust.
