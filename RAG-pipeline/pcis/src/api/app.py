"""
FastAPI Application Factory.

Creates and configures the PCIS application with all middleware,
routes, and lifecycle events.
"""

import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.config.settings import settings
from src.config.database import DatabaseManager
from src.config.logging_config import setup_logging
from src.domain.exceptions.domain_exceptions import (
    PCISBaseException,
    AuthenticationException,
    AuthorizationException,
    ValidationException,
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle: startup and shutdown hooks."""
    # Startup
    setup_logging()
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")
    await DatabaseManager.connect()
    logger.info("Application startup complete")
    yield
    # Shutdown
    await DatabaseManager.disconnect()
    logger.info("Application shutdown complete")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="PCIS — Police Case Intelligence System",
        description=(
            "Enterprise-grade police records management platform for "
            "storing, organizing, searching, and managing case records."
        ),
        version=settings.app_version,
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # ── CORS Middleware ──────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Request ID Middleware ────────────────────────────────────────
    @app.middleware("http")
    async def add_request_id(request: Request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

    # ── Exception Handlers ───────────────────────────────────────────
    @app.exception_handler(AuthenticationException)
    async def auth_exception_handler(request: Request, exc: AuthenticationException):
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"error": {"code": exc.code, "message": exc.message}},
        )

    @app.exception_handler(AuthorizationException)
    async def authz_exception_handler(request: Request, exc: AuthorizationException):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"error": {"code": exc.code, "message": exc.message}},
        )

    @app.exception_handler(ValidationException)
    async def validation_exception_handler(request: Request, exc: ValidationException):
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "details": exc.errors,
                }
            },
        )

    @app.exception_handler(PCISBaseException)
    async def pcis_exception_handler(request: Request, exc: PCISBaseException):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": {"code": exc.code, "message": exc.message}},
        )

    # ── Register Routes ──────────────────────────────────────────────
    from src.api.routes.auth_routes import router as auth_router
    from src.api.routes.case_routes import router as case_router
    from src.api.routes.person_routes import router as person_router
    from src.api.routes.resource_routes import (
        station_router,
        officer_router,
        evidence_router,
        note_router,
        document_router,
        activity_router,
    )
    from src.api.routes.ingestion_routes import router as ingestion_router
    from src.api.routes.dataset_routes import router as dataset_router
    from src.ai.routers.rag_routes import router as ai_router

    api_prefix = "/api/v1"
    app.include_router(ingestion_router, prefix=api_prefix)
    app.include_router(dataset_router, prefix=api_prefix)
    app.include_router(auth_router, prefix=api_prefix)
    app.include_router(case_router, prefix=api_prefix)
    app.include_router(person_router, prefix=api_prefix)
    app.include_router(station_router, prefix=api_prefix)
    app.include_router(officer_router, prefix=api_prefix)
    app.include_router(evidence_router, prefix=api_prefix)
    app.include_router(note_router, prefix=api_prefix)
    app.include_router(document_router, prefix=api_prefix)
    app.include_router(activity_router, prefix=api_prefix)
    app.include_router(ai_router, prefix=api_prefix)

    # ── Health Check ─────────────────────────────────────────────────
    @app.get("/health", tags=["Health"])
    async def health_check():
        return {
            "status": "healthy",
            "service": settings.app_name,
            "version": settings.app_version,
        }

    return app
