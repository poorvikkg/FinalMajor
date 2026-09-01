"""LangGraph State Definition."""

from typing import TypedDict, List, Dict, Any
from langchain_core.documents import Document

class RAGState(TypedDict):
    """The State object for the LangGraph Workflow."""
    query: str
    intent: str
    source_route: str
    mongo_records: List[Dict[str, Any]]
    vector_docs: List[Document]
    context: str
    response: str
