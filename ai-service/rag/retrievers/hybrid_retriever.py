"""Hybrid Retriever for Surveillance & PCIS RAG."""

from typing import List, Dict, Any, Tuple
from langchain_core.documents import Document
from .mongo_retriever import MongoRetriever
from .vector_retriever import VectorRetriever


class HybridRetriever:
    """Combines structured MongoDB multi-collection results and unstructured FAISS chunks."""

    def __init__(self):
        self.vector_retriever = VectorRetriever()

    async def retrieve(
        self, 
        query: str, 
        mongo_filters: Dict[str, Any] = None, 
        mongo_collection: str = "all",
        vector_filters: Dict[str, Any] = None,
        top_k: int = 5
    ) -> Tuple[List[Dict[str, Any]], List[Document]]:
        """Executes retrieval across MongoDB database and FAISS vector store."""
        
        # 1. Execute MongoDB Search
        mongo_results = []
        if mongo_filters is not None or mongo_collection is not None:
            try:
                mongo_results = await MongoRetriever.multi_retrieve(
                    query=query,
                    filters=mongo_filters,
                    limit=top_k
                )
            except Exception as e:
                print(f"Error in MongoRetriever multi_retrieve: {e}")

        # 2. Execute Vector Search (if available)
        vector_results = []
        try:
            vector_results = self.vector_retriever.search(
                query=query, 
                top_k=top_k, 
                filter=vector_filters
            )
        except Exception as e:
            # Vector store may be empty or unbuilt, non-fatal
            print(f"Vector search skipped or empty: {e}")

        return mongo_results, vector_results
