"""
Unit tests for Deduplicator engine.
"""

import pytest
from src.ingestion.duplicate_checker.deduplicator import Deduplicator


@pytest.mark.asyncio
async def test_deduplicator_in_batch():
    dedup = Deduplicator()
    rec1 = {"fir_number": "FIR/2025/MUM/001", "crime_type": "THEFT"}
    rec2 = {"fir_number": "FIR/2025/MUM/001", "crime_type": "THEFT"}

    is_dup1 = await dedup.is_duplicate(rec1, collection_name="cases")
    is_dup2 = await dedup.is_duplicate(rec2, collection_name="cases")

    assert is_dup1 is False
    assert is_dup2 is True
