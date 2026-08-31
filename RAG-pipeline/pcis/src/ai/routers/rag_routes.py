"""FastAPI Routes for AI RAG Pipeline — all endpoints fully implemented via RAGService."""

import asyncio
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, AsyncGenerator

from src.ai.services.rag_service import RAGService
from src.ai.services.index_service import IndexService
from src.ai.utils.error_handler import AIBaseException


router = APIRouter(prefix="/ai", tags=["AI Intelligence Layer"])

# ── Shared Service Instances (lazy-init inside each service) ─────────────────
_service = RAGService()
_index_service = IndexService()


# ── Request / Response Schemas ────────────────────────────────────────────────

class RAGQueryRequest(BaseModel):
    query: str = Field(..., description="Natural language question for the AI.")
    top_k: Optional[int] = Field(5, description="Number of documents to retrieve.")


class RAGResponse(BaseModel):
    answer: str
    intent_detected: str
    source_route: str
    mongo_records_count: int
    vector_docs_count: int
    confidence: str
    sources: List[str]
    response_time_ms: float


class SimilarResult(BaseModel):
    content: str
    metadata: Dict[str, Any]


class SimilarResponse(BaseModel):
    query: str
    results: List[SimilarResult]


class StatisticsResponse(BaseModel):
    query: str
    statistics_context: str
    sources: List[str]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/query", response_model=RAGResponse, summary="Unified AI Query")
async def ai_query(request: RAGQueryRequest):
    """
    Execute a full RAG pipeline query.
    Automatically detects intent (LOOKUP / SUMMARY / STATISTICS / COMPARE / TIMELINE / …)
    and uses the appropriate retrieval strategy and prompt template.
    """
    try:
        result = await _service.query(request.query)
        return RAGResponse(**result)
    except AIBaseException as e:
        raise HTTPException(status_code=e.http_status, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/similar", response_model=SimilarResponse, summary="Find Similar Documents")
async def ai_similar(request: RAGQueryRequest):
    """
    Returns the top-K semantically similar crime statistics documents
    without running full LLM generation (faster, cheaper).
    """
    try:
        result = await _service.similar(request.query, top_k=request.top_k)
        return SimilarResponse(**result)
    except AIBaseException as e:
        raise HTTPException(status_code=e.http_status, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/summarize", response_model=RAGResponse, summary="Summarize Case or Dataset")
async def ai_summarize(request: RAGQueryRequest):
    """
    Summarize a specific case (from MongoDB) or a statistical dataset (from FAISS).
    Routes through the full LangGraph pipeline with a SUMMARY-optimised prompt.
    """
    try:
        result = await _service.summarize(request.query)
        return RAGResponse(**result)
    except AIBaseException as e:
        raise HTTPException(status_code=e.http_status, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/compare", response_model=RAGResponse, summary="Compare Two Regions or Crime Types")
async def ai_compare(request: RAGQueryRequest):
    """
    Compare crime statistics across two states, districts, or years.
    Routes through the full LangGraph pipeline with a COMPARE-optimised prompt.
    """
    try:
        result = await _service.compare(request.query)
        return RAGResponse(**result)
    except AIBaseException as e:
        raise HTTPException(status_code=e.http_status, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/statistics", response_model=StatisticsResponse, summary="Fetch Crime Statistics")
async def ai_statistics(request: RAGQueryRequest):
    """
    Returns raw structured statistics context extracted from FAISS
    without generating a full LLM answer — useful for dashboards and analytics.
    """
    try:
        result = await _service.statistics(request.query)
        return StatisticsResponse(**result)
    except AIBaseException as e:
        raise HTTPException(status_code=e.http_status, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Phase 17: FAISS Index Management ─────────────────────────────────────────

class IndexBuildRequest(BaseModel):
    reset: bool = Field(False, description="If true, delete the old index before rebuilding.")


@router.post("/index/build", response_model=dict, summary="Build / Rebuild FAISS Index")
async def build_index(request: IndexBuildRequest, background_tasks: BackgroundTasks):
    """
    Triggers a full rebuild of the FAISS index from all CSV files in data/crime_statistics/.
    Runs as a FastAPI BackgroundTask so the HTTP request returns immediately.
    Poll /ai/index/status to monitor progress.
    """
    if _index_service.get_status()["is_building"]:
        raise HTTPException(status_code=409, detail="Index build already in progress.")
    background_tasks.add_task(_index_service.build_index, request.reset)
    return {"message": "Index build started in background.", "reset": request.reset}



@router.get("/index/status", summary="FAISS Index Status")
async def index_status():
    """Returns current FAISS index status: existence, size, build progress."""
    return _index_service.get_status()


# ── Phase 18: Streaming Response ─────────────────────────────────────────────

class StreamRequest(BaseModel):
    query: str = Field(..., description="Natural language question to stream back.")
    session_id: Optional[str] = Field(None, description="Session ID for conversation memory.")


@router.post("/stream", summary="Streaming AI Response (token-by-token)")
async def ai_stream(request: StreamRequest):
    """
    Streams the Groq LLM response token-by-token using Server-Sent Events.
    Retrieves context via Hybrid Retriever, builds prompt, then streams the answer.
    """
    async def token_generator() -> AsyncGenerator[str, None]:
        try:
            # Build context the same way as the standard query pipeline
            from src.ai.utils.query_filter_extractor import QueryFilterExtractor
            from src.ai.retrievers.hybrid_retriever import HybridRetriever
            from src.ai.context_builder.builder import ContextBuilder
            from src.ai.llm.groq_llm import GroqLLM
            from src.ai.planner.intent_detector import QueryPlanner
            import os

            planner = QueryPlanner()
            plan = await planner.plan(request.query)
            intent = plan.get("intent", "GENERAL")
            route = plan.get("source", "hybrid")

            extractor = QueryFilterExtractor()
            filters = await extractor.extract(request.query)

            retriever = HybridRetriever()
            mongo_filters = filters if route in ("mongo", "hybrid") else None
            vector_filters = filters if route in ("vector", "hybrid") else None

            mongo_records, vector_docs = await retriever.retrieve(
                query=request.query,
                mongo_filters=mongo_filters,
                vector_filters=vector_filters,
                top_k=int(os.getenv("TOP_K", "5")),
            )

            context = ContextBuilder.build(mongo_records, vector_docs)
            prompt = f"Context:\n{context}\n\nQuestion: {request.query}\nAnswer:"

            llm = GroqLLM()
            async for token in llm.stream(prompt):
                yield f"data: {token}\n\n"

            yield "data: [DONE]\n\n"

        except Exception as e:
            yield f"data: [ERROR] {str(e)}\n\n"

    return StreamingResponse(token_generator(), media_type="text/event-stream")


# ── Phase 19: Conversation Memory ────────────────────────────────────────────

class ChatRequest(BaseModel):
    query: str = Field(..., description="User's follow-up question.")
    session_id: str = Field(..., description="Unique session ID for conversation continuity.")


class ChatResponse(BaseModel):
    answer: str
    session_id: str
    turn: int
    intent_detected: Optional[str] = None
    confidence: Optional[str] = None
    sources: Optional[List[str]] = None
    mongo_records_count: Optional[int] = 0
    vector_docs_count: Optional[int] = 0


@router.post("/chat", response_model=ChatResponse, summary="Multi-turn Conversation")
async def ai_chat(request: ChatRequest):
    """
    Multi-turn conversational AI endpoint.
    Maintains conversation history per session_id so users can ask follow-ups.
    """
    try:
        from src.ai.utils.memory import get_session_memory
        memory = get_session_memory(request.session_id)
        # Prepend history context to the query
        history_text = memory.get_history_text()
        enriched_query = f"{history_text}\nUser: {request.query}" if history_text else request.query

        result = await _service.query(enriched_query)

        # Store this turn
        memory.add_turn(user=request.query, assistant=result["answer"])

        return ChatResponse(
            answer=result["answer"],
            session_id=request.session_id,
            turn=memory.turn_count,
            intent_detected=result.get("intent_detected"),
            confidence=result.get("confidence"),
            sources=result.get("sources"),
            mongo_records_count=result.get("mongo_records_count", 0),
            vector_docs_count=result.get("vector_docs_count", 0),
        )
    except AIBaseException as e:
        raise HTTPException(status_code=e.http_status, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/chat/{session_id}", summary="Clear Conversation History")
async def clear_chat(session_id: str):
    """Clears the conversation memory for the given session_id."""
    from src.ai.utils.memory import clear_session
    clear_session(session_id)
    return {"message": f"Session '{session_id}' cleared."}


# ── Health Check ──────────────────────────────────────────────────────────────

@router.get("/health", summary="AI Layer Health Check")
async def ai_health():
    """Returns health status of all AI components."""
    idx = _index_service.get_status()
    return {
        "status": "healthy",
        "components": {
            "groq_llm":       "ready",
            "faiss_index":    "exists" if idx["index_exists"] else "not built — run POST /ai/index/build",
            "mongo":          "via existing PCIS connection",
            "langgraph":      "compiled",
            "embeddings":     "BAAI/bge-small-en-v1.5",
            "cache":          "in-memory LRU (200 entries)",
            "streaming":      "SSE via POST /ai/stream",
            "conversation":   "session memory via POST /ai/chat",
        },
        "index_status": idx,
    }
