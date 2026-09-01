"""
Index Creation Script.

Run with: python -m scripts.create_indexes
"""

import asyncio
import logging

from src.config.database import DatabaseManager
from src.config.logging_config import setup_logging
from src.infrastructure.database.mongodb.indexes import create_all_indexes

logger = logging.getLogger(__name__)


async def main():
    setup_logging()
    await DatabaseManager.connect()
    await create_all_indexes()
    await DatabaseManager.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
