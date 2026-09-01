"""Audit Store: persists every RAG query + response to the ai_audit_logs MongoDB collection."""

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from rag.database import DatabaseManager

AUDIT_COLLECTION = "ai_audit_logs"


class AuditStore:
    """Async writer for AI audit logs into MongoDB."""

    @staticmethod
    async def save(
        query: str,
        intent: str,
        source_route: str,
        answer: str,
        mongo_records_count: int,
        vector_docs_count: int,
        prompt_tokens: int,
        completion_tokens: int,
        response_time_ms: float,
        confidence: str,
        sources: list,
        cache_hit: bool = False,
        session_id: Optional[str] = None,
        error: Optional[str] = None,
    ) -> None:
        """
        Write a single audit log entry. Silently swallows errors so a logging
        failure never blocks the main query response.
        """
        try:
            collection = DatabaseManager.get_collection(AUDIT_COLLECTION)
            doc = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "query": query,
                "intent": intent,
                "source_route": source_route,
                "answer_preview": answer[:200] if answer else "",
                "mongo_records_count": mongo_records_count,
                "vector_docs_count": vector_docs_count,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "response_time_ms": response_time_ms,
                "confidence": confidence,
                "sources": sources,
                "cache_hit": cache_hit,
                "session_id": session_id,
                "error": error,
            }
            await collection.insert_one(doc)
        except Exception:
            pass  # Non-critical — never raise from audit
