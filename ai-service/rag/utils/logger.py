"""Structured logger for the PCIS AI RAG pipeline."""

import time
import logging
import structlog
from typing import Any, Dict

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.add_log_level,
        structlog.dev.ConsoleRenderer(),
    ],
    wrapper_class=structlog.BoundLogger,
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
)

ai_logger = structlog.get_logger("pcis.ai")


def _safe_str(s: Any) -> str:
    """Ensure strings are safe to print on Windows console with any code page."""
    if not isinstance(s, str):
        return str(s)
    # Truncate very long log texts and encode safely
    truncated = s[:200] + ("..." if len(s) > 200 else "")
    return truncated.encode("ascii", errors="replace").decode("ascii")


def log_query_start(query: str, intent: str = "", source: str = ""):
    ai_logger.info("rag_query_start", query=_safe_str(query), intent=intent, source_route=source)


def log_retrieval(mongo_count: int, vector_count: int, elapsed_ms: float):
    ai_logger.info(
        "rag_retrieval_complete",
        mongo_records=mongo_count,
        vector_docs=vector_count,
        elapsed_ms=round(elapsed_ms, 2),
    )


def log_generation(prompt_tokens: int, completion_tokens: int, elapsed_ms: float):
    ai_logger.info(
        "rag_generation_complete",
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        elapsed_ms=round(elapsed_ms, 2),
    )


def log_error(context: str, error: Exception):
    ai_logger.error("rag_error", context=context, error=str(error))


class Timer:
    """Context manager for elapsed time measurement."""

    def __init__(self):
        self.elapsed_ms: float = 0.0

    def __enter__(self):
        self._start = time.perf_counter()
        return self

    def __exit__(self, *args):
        self.elapsed_ms = (time.perf_counter() - self._start) * 1000
