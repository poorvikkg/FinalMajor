"""FAISS Vectorstore Integration."""

import os
from typing import List, Dict, Any
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from src.ai.embeddings.embedding_generator import EmbeddingGenerator

class PCISVectorStore:
    """Handles FAISS vector storage, persistence, and loading."""

    def __init__(self, index_path: str = None):
        self.index_path = index_path or os.getenv("FAISS_INDEX_PATH", "./storage/faiss_index")
        self._embeddings = EmbeddingGenerator().get_model()
        self.vectorstore = None


    def load_or_create(self):
        """Lazy load the FAISS index if it exists, otherwise initialize an empty one."""
        if os.path.exists(self.index_path) and os.path.exists(os.path.join(self.index_path, "index.faiss")):
            self.vectorstore = FAISS.load_local(
                folder_path=self.index_path,
                embeddings=self._embeddings,
                allow_dangerous_deserialization=True
            )
        else:
            # Create a dummy index to establish the dimensions
            dummy_doc = Document(page_content="Initialization document", metadata={"source": "init"})
            self.vectorstore = FAISS.from_documents([dummy_doc], self._embeddings)
            
    def add_documents(self, documents: List[Document]):
        """Batch add documents to the FAISS index and persist to disk."""
        if self.vectorstore is None:
            self.vectorstore = FAISS.from_documents(documents, self._embeddings)
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
            
        if search_type == "mmr":
            return self.vectorstore.max_marginal_relevance_search(query, k=top_k, filter=filter)
        return self.vectorstore.similarity_search(query, k=top_k, filter=filter)
