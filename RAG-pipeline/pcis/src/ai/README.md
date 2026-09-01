# PCIS AI Intelligence Layer

> Production-grade Retrieval-Augmented Generation (RAG) pipeline built on LangChain, LangGraph, FAISS, and Groq (LLaMA 3).

---

## Architecture

```
User Query
    │
    ▼
┌─────────────────────────────────────────────────┐
│                 FastAPI Endpoints                │
│  /query  /stream  /chat  /similar  /statistics  │
└─────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────┐
│                  RAG Service                    │
│  Cache check → Workflow → Audit log              │
└─────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────┐
│              LangGraph StateGraph               │
│                                                 │
│  [Planner] → [Retriever] → [Context] → [LLM]   │
│                                                 │
│  • Planner: classifies intent (8 types)         │
│  • Retriever: Mongo + FAISS hybrid              │
│  • Context: Markdown builder (no raw JSON)      │
│  • LLM: Groq LLaMA 3.3 70B, intent-specific    │
│         prompt template selection               │
└─────────────────────────────────────────────────┘
```

---

## Module Reference

| Module | Purpose |
|---|---|
| `embeddings/csv_loader.py` | Chunks 76 crime CSVs into semantic paragraphs with metadata |
| `embeddings/embedding_generator.py` | Singleton `BAAI/bge-small-en-v1.5` model (lazy-loaded) |
| `vectorstore/faiss_store.py` | FAISS persistence: load, add, search (similarity + MMR) |
| `retrievers/mongo_retriever.py` | Async Motor queries on cases/persons/officers collections |
| `retrievers/vector_retriever.py` | FAISS search with optional metadata filter |
| `retrievers/hybrid_retriever.py` | Parallel Mongo + FAISS retrieval |
| `planner/intent_detector.py` | LLM intent classifier (LOOKUP/SUMMARY/STATISTICS/COMPARE/TIMELINE/FILTER/SIMILARITY/GENERAL) |
| `context_builder/builder.py` | Formats retrieved data into clean Markdown context |
| `prompts/*.txt` | Separated prompt templates per intent |
| `llm/groq_llm.py` | Groq API wrapper with `generate` and `stream` |
| `workflow/graph.py` | LangGraph StateGraph — full pipeline orchestration |
| `services/rag_service.py` | Business logic: cache, timeout, audit, error handling |
| `services/index_service.py` | FAISS index build management + status tracking |
| `utils/cache.py` | LRU query cache (200 entries, MD5-keyed) |
| `utils/memory.py` | In-memory session store for multi-turn chat |
| `utils/audit_store.py` | MongoDB audit log writer (fire-and-forget) |
| `utils/logger.py` | Structured `structlog` logger + `Timer` |
| `utils/token_counter.py` | Prompt/completion token estimator |
| `utils/error_handler.py` | Custom AI exception hierarchy with HTTP status codes |
| `utils/query_filter_extractor.py` | LLM → MongoDB filter dict extractor |
| `routers/rag_routes.py` | All REST endpoints (query/stream/chat/similar/statistics/index) |

---

## Setup

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure environment
Copy `.env.example` to `.env` and fill in:
```dotenv
GROQ_API_KEY=your_groq_key_here
EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
FAISS_INDEX_PATH=./storage/faiss_index
TOP_K=5
LLM_TIMEOUT_SECONDS=60
```

### 3. Build the FAISS index
```bash
python scripts/build_rag_index.py
```
This will embed all 76 CSV datasets (~minutes on CPU). You only need to run this once (or after adding new datasets).

### 4. Start the server
```bash
uvicorn src.api.app:app --reload
```

---

## API Endpoints (all under `/api/v1/ai/`)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/query` | Full RAG pipeline (intent-detected, prompt-routed) |
| `POST` | `/stream` | Token-by-token streaming via SSE |
| `POST` | `/chat` | Multi-turn conversation with session memory |
| `DELETE` | `/chat/{session_id}` | Clear conversation history |
| `POST` | `/similar` | Semantic similarity search (no LLM generation) |
| `POST` | `/summarize` | Case/dataset summarization |
| `POST` | `/compare` | Side-by-side comparison |
| `POST` | `/statistics` | Raw statistics context (no LLM) |
| `POST` | `/index/build` | Trigger FAISS index rebuild in background |
| `GET` | `/index/status` | FAISS index build status and metadata |
| `GET` | `/health` | System health check |

### Example: Query
```bash
curl -X POST "http://localhost:8000/api/v1/ai/query" \
  -H "Content-Type: application/json" \
  -d '{"query": "What are the murder statistics in Karnataka for 2014?"}'
```

### Example: Stream
```bash
curl -X POST "http://localhost:8000/api/v1/ai/stream" \
  -H "Content-Type: application/json" \
  -d '{"query": "Summarise property theft trends in southern India"}' \
  --no-buffer
```

### Example: Multi-turn Chat
```bash
# Turn 1
curl -X POST "http://localhost:8000/api/v1/ai/chat" \
  -d '{"query": "Murder stats in Karnataka 2014", "session_id": "user-abc"}'

# Turn 2 (follow-up)
curl -X POST "http://localhost:8000/api/v1/ai/chat" \
  -d '{"query": "Now compare that with Kerala", "session_id": "user-abc"}'
```

---

## Running Tests
```bash
pytest tests/test_rag.py -v
```

---

## Intent Types

| Intent | Trigger Pattern | Prompt Used |
|---|---|---|
| `STATISTICS` | "how many", "count", "rate", "percent" | `statistics_prompt.txt` |
| `SUMMARY` | "summarize", "overview", "brief" | `summary_prompt.txt` |
| `COMPARE` | "compare", "versus", "difference between" | `compare_prompt.txt` |
| `TIMELINE` | "trend", "over years", "from X to Y" | `timeline_prompt.txt` |
| `LOOKUP` | "find case", "show me FIR" | `general_prompt.txt` |
| `FILTER` | "cases in", "status open" | `general_prompt.txt` |
| `SIMILARITY` | "similar to", "like case" | `general_prompt.txt` |
| `GENERAL` | fallback | `general_prompt.txt` |
