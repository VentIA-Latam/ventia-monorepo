"""
VentIA Backend - FastAPI application entry point.
"""

import logging

import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.api import api_router
from app.core.config import settings
from app.services.messaging_service import MessagingClientError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Initialize Sentry before creating the app
if settings.SENTRY_DSN:
    try:
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.ENVIRONMENT,
            traces_sample_rate=0.2 if settings.ENVIRONMENT == "production" else 1.0,
            send_default_pii=False,
            release=f"ventia-backend@{settings.VERSION}",
        )
        logger.info("Sentry initialized for environment: %s", settings.ENVIRONMENT)
    except Exception as e:
        logger.warning("Failed to initialize Sentry: %s", e)

# Create FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="VentIA Backend API - Multitenant order management with Shopify integration",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    redirect_slashes=False,  # Evita 307 redirects que pierden el header Authorization
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)


# Propagate 4xx errors from the Rails messaging service with their original status + detail
# so the operator sees the real reason (e.g. "Template not found") instead of a 503.
@app.exception_handler(MessagingClientError)
async def messaging_client_error_handler(request: Request, exc: MessagingClientError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


@app.get("/", tags=["root"])
async def root() -> dict:
    """
    Root endpoint.

    Returns basic API information.
    """
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": f"{settings.API_V1_STR}/docs",
        "health": f"{settings.API_V1_STR}/health",
    }
