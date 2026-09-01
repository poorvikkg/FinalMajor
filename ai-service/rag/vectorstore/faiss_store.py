"""FAISS Vectorstore Integration."""

import os
from typing import List, Dict, Any
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from rag.embeddings.embedding_generator import EmbeddingGenerator

class PCISVectorStore:
    """Handles FAISS vector storage, persistence, and loading."""

    def __init__(self, index_path: str = None):
        self.index_path = index_path or os.getenv("FAISS_INDEX_PATH", "./storage/faiss_index")
        self._embeddings = None
        self.vectorstore = None

    @property
    def embeddings(self):
        if self._embeddings is None:
            self._embeddings = EmbeddingGenerator().get_model()
        return self._embeddings

    def load_or_create(self):
        """Lazy load the FAISS index if it exists on disk, otherwise keep vectorstore as None."""
        if os.path.exists(self.index_path) and os.path.exists(os.path.join(self.index_path, "index.faiss")):
            try:
                self.vectorstore = FAISS.load_local(
                    folder_path=self.index_path,
                    embeddings=self.embeddings,
                    allow_dangerous_deserialization=True
                )
            except Exception as e:
                print(f"Failed to load FAISS index from {self.index_path}: {e}")
                self.vectorstore = None
        else:
            self.vectorstore = None
            
    def add_documents(self, documents: List[Document]):
        """Batch add documents to the FAISS index and persist to disk."""
        if not documents:
            return
        if self.vectorstore is None:
            self.vectorstore = FAISS.from_documents(documents, self.embeddings)
        else:
            self.vectorstore.add_documents(documents)
            
        # Persist immediately after adding
        self.persist()

    def persist(self):
        """Save the FAISS index to disk."""
        if self.vectorstore:
            os.makedirs(self.index_path, exist_ok=True)
            self.vectorstore.save_local(self.index_path)

    def search(self, query: str, top_k: int = 5, search_type: str = "similarity", filter: Dict[str, Any] = None) -> List[Document]:
        """Search the FAISS index using Similarity or MMR."""
        if not self.vectorstore:
            self.load_or_create()
            
        if not self.vectorstore:
            return []
            
        try:
            if search_type == "mmr":
                results = self.vectorstore.max_marginal_relevance_search(query, k=top_k, filter=filter)
            else:
                results = self.vectorstore.similarity_search(query, k=top_k, filter=filter)
            # Filter out dummy initialization docs
            return [d for d in results if d.metadata.get("source") != "init"]
        except Exception:
            return []
