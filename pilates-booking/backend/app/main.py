import time
import uuid
from contextlib import asynccontextmanager

import redis
from fastapi import Depends, FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from .api.v1.api import api_router
from .core.config import settings
from .core.database import engine, init_db
from .core.database_logging import setup_database_logging
from .core.logging_config import get_logger, setup_logging
from .middleware.logging import LoggingMiddleware
from .middleware.security import (InputSanitizationMiddleware,
                                  IPWhitelistMiddleware, RateLimitMiddleware,
                                  SecurityMiddleware)
from .services.business_logging_service import business_logger, EventType


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    setup_logging()
    logger = get_logger("app")

    # Database logging disabled for performance
    # setup_database_logging(engine)

    # Log system startup
    logger.info("Starting Pilates Booking System API")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"Debug mode: {settings.DEBUG}")

    # Log startup as business event
    business_logger.log_system_startup(
        environment=settings.ENVIRONMENT,
        version="1.0.0",  # You might want to get this from a version file
    )

    # Initialize Redis connection
    try:
        redis_client = redis.from_url(settings.REDIS_URL)
        redis_client.ping()
        logger.info("Redis connection established")
        app.state.redis = redis_client
    except Exception as e:
        logger.warning(f"Redis connection failed: {e}. Rate limiting will be disabled.")
        app.state.redis = None

    await init_db()
    logger.info("Database initialized")

    yield

    # Shutdown
    logger.info("Shutting down Pilates Booking System API")
    business_logger.log_event(EventType.SYSTEM_SHUTDOWN)

    if hasattr(app.state, "redis") and app.state.redis:
        app.state.redis.close()


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json" if settings.API_V1_STR.startswith("/") else f"/{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)


# Add middleware (order matters - last added = first executed)
# Logging middleware should be first to capture all requests
app.add_middleware(LoggingMiddleware)
app.add_middleware(SecurityMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(InputSanitizationMiddleware)

# Add IP whitelist for admin operations (if configured)
admin_whitelist = []  # Configure this in production
if admin_whitelist:
    app.add_middleware(IPWhitelistMiddleware, whitelist=admin_whitelist)

# Set all CORS enabled origins
cors_origins = settings.cors_origins_list
if cors_origins:
    # Configure CORS properly for production
    if settings.ENVIRONMENT == "production":
        # Remove wildcard in production
        cors_origins = [origin for origin in cors_origins if origin != "*"]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in cors_origins],
        allow_credentials=True,
        allow_methods=[
            "GET",
            "POST",
            "PUT",
            "DELETE",
            "PATCH",
        ],  # Specific methods in production
        allow_headers=[
            "Authorization",
            "Content-Type",
            "X-Request-ID",
        ],  # Specific headers
        expose_headers=["X-Request-ID", "API-Version"],
    )

app.include_router(api_router, prefix=settings.API_V1_STR if settings.API_V1_STR.startswith("/") else f"/{settings.API_V1_STR}")


@app.get("/")
async def root():
    return {"message": "Pilates Booking System API"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
