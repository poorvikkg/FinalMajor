"""Index Service: manages FAISS index build lifecycle."""

import os
import time
from datetime import datetime, timezone
from typing import Dict, Any

from langchain_core.documents import Document

from src.ai.embeddings.csv_loader import CSVIntelligentLoader
from src.ai.vectorstore.faiss_store import PCISVectorStore
from src.ai.utils.logger import ai_logger, log_error


class _IndexStatus:
    """Simple in-memory status tracker for the index build job."""
    is_building: bool = False
    last_built_at: str = "never"
    total_chunks: int = 0
    total_files: int = 0
    error: str = ""


_status = _IndexStatus()


class IndexService:
    """Handles building and reporting on the FAISS vector index."""

    DATA_DIR = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "crime_statistics")
    )

    def get_status(self) -> Dict[str, Any]:
        """Return the current index build status."""
        store = PCISVectorStore()
        index_exists = os.path.exists(
            os.path.join(store.index_path, "index.faiss")
        )
        return {
            "index_exists": index_exists,
            "is_building": _status.is_building,
            "last_built_at": _status.last_built_at,
            "total_chunks_indexed": _status.total_chunks,
            "total_files_processed": _status.total_files,
            "last_error": _status.error or None,
            "faiss_index_path": store.index_path,
        }

    def build_index(self, reset: bool = False) -> Dict[str, Any]:
        """
        Rebuild the FAISS index from all CSV files in data/crime_statistics/.
        - reset=True: deletes the old index before rebuilding.
        - Returns a summary of the build job.
        """
        if _status.is_building:
            return {"message": "Index build already in progress.", "status": "busy"}

        _status.is_building = True
        _status.error = ""
        _status.total_chunks = 0
        _status.total_files = 0

        start_time = time.perf_counter()

        try:
            store = PCISVectorStore()

            if reset and os.path.exists(store.index_path):
                import shutil
                shutil.rmtree(store.index_path)
                ai_logger.info("faiss_index_reset", path=store.index_path)

            store.load_or_create()

            if not os.path.exists(self.DATA_DIR):
                raise FileNotFoundError(
                    f"Crime statistics directory not found at: {self.DATA_DIR}"
                )

            loader = CSVIntelligentLoader(
                data_dir=self.DATA_DIR, chunk_size=500, overlap=100
            )

            csv_files = loader.get_csv_files()
            _status.total_files = len(csv_files)
            ai_logger.info("faiss_build_started", files=_status.total_files)

            batch: list[Document] = []
            BATCH_SIZE = 100

            for chunk in loader.load_and_chunk():
                doc = Document(page_content=chunk.content, metadata=chunk.metadata)
                batch.append(doc)

                if len(batch) >= BATCH_SIZE:
                    store.add_documents(batch)
                    _status.total_chunks += len(batch)
                    batch = []

            if batch:
                store.add_documents(batch)
                _status.total_chunks += len(batch)

            elapsed = round((time.perf_counter() - start_time) * 1000, 2)
            _status.last_built_at = datetime.now(timezone.utc).isoformat()

            ai_logger.info(
                "faiss_build_complete",
                chunks=_status.total_chunks,
                elapsed_ms=elapsed,
            )

            return {
                "message": "Index built successfully.",
                "total_chunks": _status.total_chunks,
                "total_files": _status.total_files,
                "elapsed_ms": elapsed,
                "built_at": _status.last_built_at,
            }

        except Exception as e:
            _status.error = str(e)
            log_error("index_service.build_index", e)
            raise
        finally:
            _status.is_building = False
