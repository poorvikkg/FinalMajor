"""
PCIS Application Entry Point.

Run with: python -m src.main
"""

import uvicorn
from dotenv import load_dotenv

# Load .env into os.environ before anything else is imported
load_dotenv()

from src.api.app import create_app
from src.config.settings import settings

app = create_app()

if __name__ == "__main__":
    uvicorn.run(
        "src.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level=settings.log_level.lower(),
    )
