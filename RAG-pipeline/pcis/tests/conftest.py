"""Pytest configuration and fixtures."""

import os
import pytest
import tempfile
import shutil
from pathlib import Path
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch

# Mock env var for tests
os.environ["GROQ_API_KEY"] = "mock_key_for_testing"


from src.api.app import create_app

@pytest.fixture
def temp_sample_dir():
    tmp = tempfile.mkdtemp()
    yield tmp
    shutil.rmtree(tmp, ignore_errors=True)

@pytest.fixture
def test_client():
    with patch("src.config.database.DatabaseManager.connect", new_callable=AsyncMock), \
         patch("src.config.database.DatabaseManager.disconnect", new_callable=AsyncMock):
        app = create_app()
        with TestClient(app) as client:
            yield client
