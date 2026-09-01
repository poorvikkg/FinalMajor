"""Comprehensive unit and integration tests for the PCIS AI RAG Pipeline."""

import os
import json
import pytest
import tempfile
from unittest.mock import AsyncMock, MagicMock, patch, mock_open


# ══════════════════════════════════════════════════════════════════════════════
# Phase 1: Embedding & CSV Loader Tests
# ══════════════════════════════════════════════════════════════════════════════

class TestCSVIntelligentLoader:
    def test_init_parameters(self):
        from src.ai.embeddings.csv_loader import CSVIntelligentLoader
        loader = CSVIntelligentLoader(data_dir=".", chunk_size=300, overlap=50)
        assert loader.chunk_size == 300
        assert loader.overlap == 50
        assert loader.data_dir == "."

    def test_row_to_text_formats_correctly(self):
        import pandas as pd
        from src.ai.embeddings.csv_loader import CSVIntelligentLoader
        loader = CSVIntelligentLoader(data_dir=".")
        row = pd.Series({"State": "Karnataka", "Year": 2014, "Murders": 150})
        text = loader._row_to_text(row, ["State", "Year", "Murders"])
        assert "Karnataka" in text
        assert "2014" in text
        assert "150" in text

    def test_row_to_text_skips_null_values(self):
        import pandas as pd
        from src.ai.embeddings.csv_loader import CSVIntelligentLoader
        loader = CSVIntelligentLoader(data_dir=".")
        row = pd.Series({"State": "Kerala", "District": None, "Year": 2013})
        text = loader._row_to_text(row, ["State", "District", "Year"])
        assert "District" not in text
        assert "Kerala" in text

    def test_load_and_chunk_with_real_csv(self, tmp_path):
        import csv
        from src.ai.embeddings.csv_loader import CSVIntelligentLoader

        # Create a small test CSV
        csv_file = tmp_path / "test_crimes.csv"
        with open(csv_file, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["Area_Name", "Year", "Cases"])
            writer.writeheader()
            for i in range(20):
                writer.writerow({"Area_Name": "Karnataka", "Year": 2010 + i, "Cases": i * 10})

        loader = CSVIntelligentLoader(data_dir=str(tmp_path), chunk_size=50)
        chunks = list(loader.load_and_chunk())

        assert len(chunks) > 0
        for chunk in chunks:
            assert chunk.content
            assert "source_file" in chunk.metadata
            assert chunk.metadata["source_file"] == "test_crimes.csv"


# ══════════════════════════════════════════════════════════════════════════════
# Phase 2: Token Counter Tests
# ══════════════════════════════════════════════════════════════════════════════

class TestTokenCounter:
    def test_count_tokens_empty_string(self):
        from src.ai.utils.token_counter import count_tokens
        assert count_tokens("") == 0

    def test_count_tokens_none(self):
        from src.ai.utils.token_counter import count_tokens
        assert count_tokens(None) == 0

    def test_count_tokens_approximate(self):
        from src.ai.utils.token_counter import count_tokens
        # 400 chars → ~100 tokens
        text = "a" * 400
        assert count_tokens(text) == 100

    def test_count_prompt_tokens(self):
        from src.ai.utils.token_counter import count_prompt_tokens
        total = count_prompt_tokens("system", "context " * 50, "query")
        assert total > 0


# ══════════════════════════════════════════════════════════════════════════════
# Phase 3: Cache Tests
# ══════════════════════════════════════════════════════════════════════════════

class TestQueryCache:
    def test_set_and_get(self):
        from src.ai.utils.cache import QueryCache
        cache = QueryCache(max_size=10)
        cache.set("What are murder rates in Karnataka?", {"answer": "100"})
        result = cache.get("What are murder rates in Karnataka?")
        assert result == {"answer": "100"}

    def test_cache_miss_returns_none(self):
        from src.ai.utils.cache import QueryCache
        cache = QueryCache()
        assert cache.get("this query was never cached") is None

    def test_case_insensitive_key(self):
        from src.ai.utils.cache import QueryCache
        cache = QueryCache()
        cache.set("MURDER IN KARNATAKA", {"answer": "test"})
        assert cache.get("murder in karnataka") is not None

    def test_lru_eviction(self):
        from src.ai.utils.cache import QueryCache
        cache = QueryCache(max_size=2)
        cache.set("query1", {"a": 1})
        cache.set("query2", {"b": 2})
        cache.set("query3", {"c": 3})  # Should evict query1
        assert cache.get("query1") is None
        assert cache.get("query2") is not None

    def test_clear(self):
        from src.ai.utils.cache import QueryCache
        cache = QueryCache()
        cache.set("q1", {"x": 1})
        cache.clear()
        assert len(cache) == 0

    def test_invalidate(self):
        from src.ai.utils.cache import QueryCache
        cache = QueryCache()
        cache.set("q1", {"x": 1})
        cache.invalidate("q1")
        assert cache.get("q1") is None


# ══════════════════════════════════════════════════════════════════════════════
# Phase 4: Error Handler Tests
# ══════════════════════════════════════════════════════════════════════════════

class TestErrorHandler:
    def test_faiss_not_found_error(self):
        from src.ai.utils.error_handler import FAISSIndexNotFoundError
        err = FAISSIndexNotFoundError("/path/to/faiss")
        assert err.http_status == 503
        assert "/path/to/faiss" in err.message

    def test_groq_timeout_error(self):
        from src.ai.utils.error_handler import GroqTimeoutError
        err = GroqTimeoutError()
        assert err.http_status == 504

    def test_empty_retrieval_error(self):
        from src.ai.utils.error_handler import EmptyRetrievalError
        err = EmptyRetrievalError("murder in Kerala")
        assert err.http_status == 404
        assert "murder in Kerala" in err.message

    def test_groq_api_error(self):
        from src.ai.utils.error_handler import GroqAPIError
        err = GroqAPIError("rate limit exceeded")
        assert err.http_status == 502
        assert "rate limit" in err.message


# ══════════════════════════════════════════════════════════════════════════════
# Phase 5: Context Builder Tests
# ══════════════════════════════════════════════════════════════════════════════

class TestContextBuilder:
    def test_build_mongo_context_with_case_record(self):
        from src.ai.context_builder.builder import ContextBuilder
        records = [{"fir_number": "FIR/2024/KAR/001", "current_status": "open", "short_summary": "Murder case"}]
        ctx = ContextBuilder.build_mongo_context(records)
        assert "FIR/2024/KAR/001" in ctx
        assert "Murder case" in ctx

    def test_build_mongo_context_empty(self):
        from src.ai.context_builder.builder import ContextBuilder
        ctx = ContextBuilder.build_mongo_context([])
        assert "No exact database records found" in ctx

    def test_build_vector_context_formats_metadata(self):
        from src.ai.context_builder.builder import ContextBuilder
        from langchain_core.documents import Document
        docs = [
            Document(
                page_content="Area Name: Karnataka | Year: 2014 | Murders: 200",
                metadata={"dataset_name": "IPC Crimes", "state": "Karnataka", "year": "2014"}
            )
        ]
        ctx = ContextBuilder.build_vector_context(docs)
        assert "Karnataka" in ctx
        assert "IPC Crimes" in ctx
        assert "2014" in ctx

    def test_build_combines_both_contexts(self):
        from src.ai.context_builder.builder import ContextBuilder
        from langchain_core.documents import Document
        mongo_records = [{"fir_number": "FIR-001", "current_status": "closed", "short_summary": "Robbery"}]
        vector_docs = [
            Document(page_content="stat data", metadata={"dataset_name": "Robbery Stats", "state": "Kerala", "year": "2012"})
        ]
        ctx = ContextBuilder.build(mongo_records, vector_docs)
        assert "FIR-001" in ctx
        assert "Robbery Stats" in ctx


# ══════════════════════════════════════════════════════════════════════════════
# Phase 6: Planner Tests (mocked LLM)
# ══════════════════════════════════════════════════════════════════════════════

class TestQueryPlanner:
    @pytest.mark.asyncio
    async def test_plan_returns_statistics_intent(self):
        from src.ai.planner.intent_detector import QueryPlanner
        with patch("src.ai.planner.intent_detector.GroqLLM") as MockLLM:
            instance = MockLLM.return_value
            instance.generate = AsyncMock(
                return_value='{"intent": "STATISTICS", "source": "vector"}'
            )
            planner = QueryPlanner()
            result = await planner.plan("How many murders in Karnataka in 2014?")
            assert result["intent"] == "STATISTICS"
            assert result["source"] == "vector"

    @pytest.mark.asyncio
    async def test_plan_defaults_on_llm_failure(self):
        from src.ai.planner.intent_detector import QueryPlanner
        with patch("src.ai.planner.intent_detector.GroqLLM") as MockLLM:
            instance = MockLLM.return_value
            instance.generate = AsyncMock(side_effect=Exception("API Error"))
            planner = QueryPlanner()
            result = await planner.plan("some query")
            assert result["intent"] == "GENERAL"
            assert result["source"] == "hybrid"

    @pytest.mark.asyncio
    async def test_plan_handles_malformed_json(self):
        from src.ai.planner.intent_detector import QueryPlanner
        with patch("src.ai.planner.intent_detector.GroqLLM") as MockLLM:
            instance = MockLLM.return_value
            instance.generate = AsyncMock(return_value="not valid json {{{")
            planner = QueryPlanner()
            result = await planner.plan("some query")
            assert result["intent"] == "GENERAL"


# ══════════════════════════════════════════════════════════════════════════════
# Phase 7: RAG Service Tests (full mocking)
# ══════════════════════════════════════════════════════════════════════════════

class TestRAGService:
    @pytest.mark.asyncio
    async def test_query_uses_cache_on_second_call(self):
        from src.ai.services.rag_service import RAGService
        from src.ai.utils.cache import QueryCache

        service = RAGService()
        # Seed the cache manually
        service._cache.set("cached query", {
            "answer": "cached answer",
            "intent_detected": "GENERAL",
            "source_route": "hybrid",
            "mongo_records_count": 0,
            "vector_docs_count": 1,
            "response_time_ms": 10.0,
            "confidence": "High",
            "sources": [],
            "cache_hit": False,
        })
        result = await service.query("cached query")
        assert result["cache_hit"] is True
        assert result["answer"] == "cached answer"

    @pytest.mark.asyncio
    async def test_statistics_returns_vector_context(self):
        from src.ai.services.rag_service import RAGService
        from langchain_core.documents import Document

        service = RAGService()

        mock_docs = [
            Document(
                page_content="Murders: 50 | Year: 2014",
                metadata={"dataset_name": "IPC Crimes", "state": "Kerala", "year": "2014", "source_file": "01.csv"}
            )
        ]
        with patch.object(service._retriever, "retrieve", new=AsyncMock(return_value=([], mock_docs))):
            with patch.object(service._filter_extractor, "extract", new=AsyncMock(return_value={})):
                result = await service.statistics("murder statistics in Kerala")
                assert "statistics_context" in result
                assert len(result["sources"]) > 0

    @pytest.mark.asyncio
    async def test_similar_returns_results(self):
        from src.ai.services.rag_service import RAGService
        from langchain_core.documents import Document

        service = RAGService()
        mock_docs = [
            Document(page_content="Crime data", metadata={"source_file": "01.csv"})
        ]
        with patch.object(service._retriever, "retrieve", new=AsyncMock(return_value=([], mock_docs))):
            with patch.object(service._filter_extractor, "extract", new=AsyncMock(return_value={})):
                result = await service.similar("crimes in Andhra Pradesh")
                assert "results" in result
                assert len(result["results"]) == 1


# ══════════════════════════════════════════════════════════════════════════════
# Phase 8: FastAPI Route Integration Tests
# ══════════════════════════════════════════════════════════════════════════════

class TestAIRoutes:
    def test_health_endpoint_returns_healthy(self, test_client):
        response = test_client.get("/api/v1/ai/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "groq_llm" in data["components"]
