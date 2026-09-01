"""Vector Retriever for PCIS RAG."""

from typing import List, Dict, Any
from langchain_core.documents import Document
from src.ai.vectorstore import PCISVectorStore

class VectorRetriever:
    """Retrieves unstructured chunks from the FAISS vector store."""

    def __init__(self):
        self.store = PCISVectorStore()

    def search(self, query: str, top_k: int = 5, search_type: str = "similarity", filter: Dict[str, Any] = None) -> List[Document]:
        """Perform a vector search."""
        return self.store.search(query, top_k=top_k, search_type=search_type, filter=filter)
