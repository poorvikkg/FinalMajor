"""Explicit Embedding Generator class wrapping HuggingFace BGE embeddings."""

import os
from langchain_huggingface import HuggingFaceEmbeddings


class EmbeddingGenerator:
    """
    Singleton-safe wrapper around HuggingFaceBgeEmbeddings.
    Provides embed_query and embed_documents methods.
    The model is lazy-loaded on first use to avoid blocking app startup.
    """

    _instance: "EmbeddingGenerator | None" = None
    _model: HuggingFaceEmbeddings | None = None

    def __new__(cls) -> "EmbeddingGenerator":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def _load(self):
        if self._model is None:
            model_name = os.getenv("EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5")
            self._model = HuggingFaceEmbeddings(
                model_name=model_name,
                model_kwargs={"device": "cpu"},
                encode_kwargs={"normalize_embeddings": True},
            )

    def get_model(self) -> HuggingFaceEmbeddings:
        """Lazily return the embedding model."""
        self._load()
        return self._model

    def embed_query(self, text: str) -> list[float]:
        self._load()
        return self._model.embed_query(text)

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        self._load()
        return self._model.embed_documents(texts)
