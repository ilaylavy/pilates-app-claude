"""
Middleware to detect and handle SQLAlchemy DetachedInstanceError issues.
"""
import logging
from typing import Any, Callable

from fastapi import Request, Response
from sqlalchemy.orm.exc import DetachedInstanceError
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class DetachedInstanceMiddleware(BaseHTTPMiddleware):
    """
    Middleware that catches DetachedInstanceError and provides better error handling.
    Also validates objects before serialization when possible.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        try:
            response = await call_next(request)
            return response
        except DetachedInstanceError as e:
            # Log the detached instance error with context
            logger.error(
                "DetachedInstanceError caught",
                extra={
                    "path": request.url.path,
                    "method": request.method,
                    "error": str(e),
                    "user_agent": request.headers.get("user-agent"),
                    "client_ip": self._get_client_ip(request),
                }
            )
            
            # Return a more user-friendly error response
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=500,
                content={
                    "detail": "Database session error. Please try again.",
                    "error_code": "DETACHED_INSTANCE"
                }
            )
        except Exception as e:
            # Check if the exception chain contains a DetachedInstanceError
            current = e
            while current:
                if isinstance(current, DetachedInstanceError):
                    logger.error(
                        "DetachedInstanceError in exception chain",
                        extra={
                            "path": request.url.path,
                            "method": request.method,
                            "error": str(e),
                            "detached_error": str(current),
                        }
                    )
                    from fastapi.responses import JSONResponse
                    return JSONResponse(
                        status_code=500,
                        content={
                            "detail": "Database session error. Please try again.",
                            "error_code": "DETACHED_INSTANCE_IN_CHAIN"
                        }
                    )
                current = current.__cause__
            
            # Re-raise if not a DetachedInstanceError
            raise

    def _get_client_ip(self, request: Request) -> str:
        """Get the real client IP address."""
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip

        return request.client.host if request.client else "unknown"


def validate_object_attached(obj: Any) -> bool:
    """
    Validate that a SQLAlchemy object is attached to a session.
    Returns True if attached or not a SQLAlchemy object.
    """
    if not hasattr(obj, '_sa_instance_state'):
        return True  # Not a SQLAlchemy object
        
    try:
        # Try to access the instance state
        state = obj._sa_instance_state
        return not state.expired and state.session is not None
    except Exception:
        return False


def safe_access_attribute(obj: Any, attr: str, default: Any = None) -> Any:
    """
    Safely access an attribute that might cause DetachedInstanceError.
    """
    try:
        return getattr(obj, attr, default)
    except DetachedInstanceError:
        logger.warning(f"DetachedInstanceError accessing {attr} on {type(obj).__name__}")
        return default
    except Exception as e:
        if "DetachedInstanceError" in str(e) or "not bound to a Session" in str(e):
            logger.warning(f"Session error accessing {attr} on {type(obj).__name__}: {e}")
            return default
        raise  # Re-raise if not session-related


class SessionValidator:
    """Utility class for validating objects are properly attached."""
    
    @staticmethod
    def validate_objects(*objects: Any) -> bool:
        """Validate multiple objects are attached."""
        return all(validate_object_attached(obj) for obj in objects if obj is not None)
    
    @staticmethod
    def log_detached_objects(*objects: Any) -> None:
        """Log information about any detached objects."""
        for i, obj in enumerate(objects):
            if obj is not None and not validate_object_attached(obj):
                logger.warning(
                    f"Detached object detected: {type(obj).__name__} at position {i}"
                )