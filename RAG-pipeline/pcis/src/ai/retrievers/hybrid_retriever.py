"""Hybrid Retriever for PCIS RAG."""

from typing import List, Dict, Any, Tuple
from langchain_core.documents import Document
from .mongo_retriever import MongoRetriever
from .vector_retriever import VectorRetriever

class HybridRetriever:
    """Combines structured Mongo results and unstructured FAISS chunks."""

    def __init__(self):
        self.vector_retriever = VectorRetriever()

    async def retrieve(
        self, 
        query: str, 
        mongo_filters: Dict[str, Any] = None, 
        mongo_collection: str = "cases",
        vector_filters: Dict[str, Any] = None,
        top_k: int = 5
    ) -> Tuple[List[Dict[str, Any]], List[Document]]:
        """
        Executes parallel or sequential retrieval across both systems.
        """
        # Execute Vector Search
        vector_results = self.vector_retriever.search(
            query=query, 
            top_k=top_k, 
            filter=vector_filters
        )
        
        # Execute Mongo Search
        mongo_results = []
        if mongo_filters is not None:
            mongo_results = await MongoRetriever.dynamic_retrieve(
                collection_name=mongo_collection, 
                filters=mongo_filters, 
                limit=top_k
            )
            
        return mongo_results, vector_results
