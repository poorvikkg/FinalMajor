"""Custom AI exceptions for the PCIS RAG pipeline."""


class AIBaseException(Exception):
    """Base exception for all AI pipeline errors."""
    http_status: int = 500

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class FAISSIndexNotFoundError(AIBaseException):
    """Raised when the FAISS index has not been built yet."""
    http_status = 503

    def __init__(self, index_path: str = ""):
        super().__init__(
            f"FAISS index not found at '{index_path}'. "
            "Run 'python scripts/build_rag_index.py' to build it first."
        )


class GroqTimeoutError(AIBaseException):
    """Raised when the Groq API call exceeds the timeout threshold."""
    http_status = 504

    def __init__(self):
        super().__init__(
            "Groq LLM request timed out. Please retry your query."
        )


class GroqAPIError(AIBaseException):
    """Raised on non-timeout Groq API failures (auth, quota, etc.)."""
    http_status = 502

    def __init__(self, detail: str = ""):
        super().__init__(f"Groq API error: {detail}")


class EmbeddingFailureError(AIBaseException):
    """Raised when the embedding model fails to encode text."""
    http_status = 500

    def __init__(self, detail: str = ""):
        super().__init__(f"Embedding generation failed: {detail}")


class EmptyRetrievalError(AIBaseException):
    """Raised when both Mongo and FAISS return zero results."""
    http_status = 404

    def __init__(self, query: str = ""):
        super().__init__(
            f"No relevant documents or records found for query: '{query}'. "
            "Try rephrasing or broadening your search."
        )


class PlannerError(AIBaseException):
    """Raised when the query planner fails to parse a valid intent."""
    http_status = 422

    def __init__(self, detail: str = ""):
        super().__init__(f"Query planner failed: {detail}")
