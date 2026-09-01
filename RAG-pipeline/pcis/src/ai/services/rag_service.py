"""RAG Service: Business logic bridge between API routes and the LangGraph workflow."""

import asyncio
import os
from typing import Any, Dict, Optional

from src.ai.workflow.graph import PCISWorkflow
from src.ai.utils.logger import log_query_start, log_retrieval, log_generation, log_error, Timer
from src.ai.utils.token_counter import count_tokens
from src.ai.utils.query_filter_extractor import QueryFilterExtractor
from src.ai.utils.cache import get_cache
from src.ai.utils.audit_store import AuditStore
from src.ai.utils.error_handler import (
    GroqTimeoutError,
    GroqAPIError,
    EmptyRetrievalError,
)
from src.ai.retrievers.hybrid_retriever import HybridRetriever
from src.ai.context_builder.builder import ContextBuilder

_LLM_TIMEOUT_SECONDS = float(os.getenv("LLM_TIMEOUT_SECONDS", "60"))


class RAGService:
    """
    Centralised service that:
      - Checks the query cache before hitting the LLM
      - Extracts structured filters via LLM
      - Runs the full LangGraph workflow with timeout protection
      - Logs timings, tokens, retrieval counts
      - Returns a standardised response dict
    """

    def __init__(self):
        self._workflow: PCISWorkflow | None = None
        self._retriever = HybridRetriever()
        self._filter_extractor = QueryFilterExtractor()
        self._cache = get_cache()

    def _get_workflow(self) -> PCISWorkflow:
        """Lazy-initialise the workflow to avoid blocking app startup."""
        if self._workflow is None:
            self._workflow = PCISWorkflow()
        return self._workflow

    async def query(self, user_query: str) -> Dict[str, Any]:
        """Run the full RAG pipeline and return a standardised response."""
        # ── Cache check ────────────────────────────────────────────────
        cached = self._cache.get(user_query)
        if cached:
            cached["cache_hit"] = True
            return cached

        log_query_start(user_query)

        with Timer() as total_timer:
            try:
                final_state = await asyncio.wait_for(
                    self._get_workflow().run(user_query),
                    timeout=_LLM_TIMEOUT_SECONDS,
                )
            except asyncio.TimeoutError:
                log_error("workflow.run", Exception("Timeout"))
                raise GroqTimeoutError()
            except Exception as e:
                log_error("workflow.run", e)
                if "groq" in str(e).lower() or "api" in str(e).lower():
                    raise GroqAPIError(str(e))
                raise

        response_text = final_state.get("response", "")
        mongo_records = final_state.get("mongo_records", [])
        vector_docs = final_state.get("vector_docs", [])

        if not mongo_records and not vector_docs:
            raise EmptyRetrievalError(user_query)

        log_retrieval(len(mongo_records), len(vector_docs), total_timer.elapsed_ms)
        log_generation(
            prompt_tokens=count_tokens(final_state.get("context", "")),
            completion_tokens=count_tokens(response_text),
            elapsed_ms=total_timer.elapsed_ms,
        )

        result = {
            "answer": response_text,
            "intent_detected": final_state.get("intent", "GENERAL"),
            "source_route": final_state.get("source_route", "hybrid"),
            "mongo_records_count": len(mongo_records),
            "vector_docs_count": len(vector_docs),
            "response_time_ms": round(total_timer.elapsed_ms, 2),
            "confidence": "High" if (mongo_records or vector_docs) else "Low",
            "sources": list({
                doc.metadata.get("source_file", "unknown")
                for doc in vector_docs
            }),
            "cache_hit": False,
        }

        # Phase 20: Persist audit log (fire-and-forget)
        asyncio.create_task(AuditStore.save(
            query=user_query,
            intent=result["intent_detected"],
            source_route=result["source_route"],
            answer=result["answer"],
            mongo_records_count=result["mongo_records_count"],
            vector_docs_count=result["vector_docs_count"],
            prompt_tokens=count_tokens(final_state.get("context", "")),
            completion_tokens=count_tokens(response_text),
            response_time_ms=result["response_time_ms"],
            confidence=result["confidence"],
            sources=result["sources"],
            cache_hit=False,
        ))

        self._cache.set(user_query, result)
        return result

    async def similar(self, user_query: str, top_k: int = 5) -> Dict[str, Any]:
        """Find semantically similar documents without full LLM generation."""
        filters = await self._filter_extractor.extract(user_query)
        _, vector_docs = await self._retriever.retrieve(
            query=user_query,
            mongo_filters=None,
            vector_filters=filters or None,
            top_k=top_k,
        )
        return {
            "query": user_query,
            "results": [
                {
                    "content": doc.page_content[:300],
                    "metadata": doc.metadata,
                }
                for doc in vector_docs
            ],
        }

    async def statistics(self, user_query: str) -> Dict[str, Any]:
        """Fetch structured statistics using vector-only retrieval."""
        filters = await self._filter_extractor.extract(user_query)
        _, vector_docs = await self._retriever.retrieve(
            query=user_query,
            mongo_filters=None,
            vector_filters=filters or None,
            top_k=int(os.getenv("TOP_K", "5")),
        )
        context = ContextBuilder.build_vector_context(vector_docs)
        return {
            "query": user_query,
            "statistics_context": context,
            "sources": list({doc.metadata.get("source_file", "?") for doc in vector_docs}),
        }

    async def summarize(self, user_query: str) -> Dict[str, Any]:
        """Summarise via the full LangGraph pipeline (intent = SUMMARY)."""
        return await self.query(user_query)

    async def compare(self, user_query: str) -> Dict[str, Any]:
        """Compare via the full LangGraph pipeline (intent = COMPARE)."""
        return await self.query(user_query)
