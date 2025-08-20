from fastapi import FastAPI, Depends, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import time
import uuid

from .core.config import settings
from .core.database import init_db
from .core.logging import setup_logging, get_logger, access_logger
from .api.v1.api import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    setup_logging()
    logger = get_logger("app")
    logger.info("Starting Pilates Booking System API")
    logger.info(f"Environment: {'Development' if settings.DEBUG else 'Production'}")
    
    await init_db()
    logger.info("Database initialized")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Pilates Booking System API")


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all requests with timing and details."""
    start_time = time.time()
    request_id = str(uuid.uuid4())[:8]
    
    # Add request ID to request state for use in endpoints
    request.state.request_id = request_id
    
    # Log request
    access_logger.info(
        f"REQUEST | {request_id} | {request.method} {request.url} | "
        f"Client: {request.client.host if request.client else 'unknown'} | "
        f"User-Agent: {request.headers.get('user-agent', 'unknown')}"
    )
    
    # Process request
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        
        # Log response
        access_logger.info(
            f"RESPONSE | {request_id} | {request.method} {request.url} | "
            f"Status: {response.status_code} | Time: {process_time:.3f}s"
        )
        
        # Add request ID to response headers
        response.headers["X-Request-ID"] = request_id
        
        return response
    
    except Exception as e:
        process_time = time.time() - start_time
        logger = get_logger("app")
        logger.error(
            f"REQUEST ERROR | {request_id} | {request.method} {request.url} | "
            f"Error: {str(e)} | Time: {process_time:.3f}s",
            exc_info=True
        )
        raise


# Set all CORS enabled origins
if settings.CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
async def root():
    return {"message": "Pilates Booking System API"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}