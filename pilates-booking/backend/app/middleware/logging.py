import json
import time
from typing import Any, Dict, Optional

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from ..core.logging_config import (clear_request_context, generate_request_id,
                                   get_logger, set_request_context)
from ..core.security import decode_token


class LoggingMiddleware(BaseHTTPMiddleware):
    """Comprehensive logging middleware for API requests and responses."""

    def __init__(self, app):
        super().__init__(app)
        self.logger = get_logger("app.access")
        self.security_logger = get_logger("app.security")

    async def dispatch(self, request: Request, call_next) -> Response:
        # Generate request ID if not already set
        if not hasattr(request.state, "request_id"):
            request.state.request_id = generate_request_id()

        request_id = request.state.request_id
        start_time = time.time()

        # Extract user information from token if available
        user_id = None
        session_id = None

        try:
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
                payload = decode_token(token)
                if payload:
                    user_id = payload.get("sub")
                    session_id = payload.get("session_id")
        except Exception:
            # Ignore token parsing errors for logging
            pass

        # Set request context for all downstream logs
        set_request_context(
            request_id=request_id, user_id=user_id, session_id=session_id
        )

        # Extract request information
        request_data = await self._extract_request_data(request)

        # Log incoming request
        self.logger.info(
            f"Incoming request: {request.method} {request.url.path}",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "query_params": dict(request.query_params),
                "user_agent": request.headers.get("user-agent"),
                "client_ip": self._get_client_ip(request),
                "content_type": request.headers.get("content-type"),
                "user_id": user_id,
                "session_id": session_id,
                "request_size": request_data.get("size", 0),
            },
        )

        try:
            # Process request
            response = await call_next(request)
            response_time = time.time() - start_time

            # Extract response information
            response_data = await self._extract_response_data(response)

            # Log response
            log_level = "warning" if response.status_code >= 400 else "info"

            getattr(self.logger, log_level)(
                f"Request completed: {request.method} {request.url.path} - {response.status_code}",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "response_time": response_time,
                    "response_size": response_data.get("size", 0),
                    "user_id": user_id,
                    "session_id": session_id,
                    "client_ip": self._get_client_ip(request),
                },
            )

            # Log slow requests
            if response_time > 1.0:
                self.logger.warning(
                    f"Slow request detected: {request.method} {request.url.path} took {response_time:.3f}s",
                    extra={
                        "request_id": request_id,
                        "method": request.method,
                        "path": request.url.path,
                        "response_time": response_time,
                        "slow_request": True,
                        "user_id": user_id,
                    },
                )

            # Log security events
            await self._log_security_events(request, response, user_id)

            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id

            return response

        except Exception as e:
            response_time = time.time() - start_time

            # Log exception
            self.logger.error(
                f"Request failed: {request.method} {request.url.path}",
                exc_info=True,
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "response_time": response_time,
                    "error": str(e),
                    "user_id": user_id,
                    "session_id": session_id,
                    "client_ip": self._get_client_ip(request),
                },
            )

            raise

        finally:
            # Clear request context
            clear_request_context()

    async def _extract_request_data(self, request: Request) -> Dict[str, Any]:
        """Extract safe request data for logging."""
        try:
            # Get content length
            content_length = request.headers.get("content-length")
            size = int(content_length) if content_length else 0

            return {
                "size": size,
                "headers": dict(request.headers),
                "method": request.method,
                "path": request.url.path,
                "query_params": dict(request.query_params),
            }
        except Exception:
            return {"size": 0}

    async def _extract_response_data(self, response: Response) -> Dict[str, Any]:
        """Extract safe response data for logging."""
        try:
            # Try to get content length from headers
            content_length = response.headers.get("content-length")
            if content_length:
                size = int(content_length)
            else:
                # If no content-length header, try to estimate from body
                if hasattr(response, "body") and response.body:
                    size = len(response.body)
                else:
                    size = 0

            return {
                "size": size,
                "headers": dict(response.headers),
                "status_code": response.status_code,
            }
        except Exception:
            return {"size": 0}

    async def _log_security_events(
        self, request: Request, response: Response, user_id: Optional[str]
    ):
        """Log security-related events."""
        try:
            # Log authentication failures
            if request.url.path.endswith("/login") and response.status_code == 401:
                self.security_logger.log_security_event(
                    "auth.login_failed",
                    severity="warning",
                    client_ip=self._get_client_ip(request),
                    user_agent=request.headers.get("user-agent"),
                )

            # Log successful logins
            elif request.url.path.endswith("/login") and response.status_code == 200:
                self.security_logger.log_security_event(
                    "auth.login_success",
                    severity="info",
                    client_ip=self._get_client_ip(request),
                    user_agent=request.headers.get("user-agent"),
                    user_id=user_id,
                )

            # Log permission denied events
            elif response.status_code == 403:
                self.security_logger.log_security_event(
                    "auth.permission_denied",
                    severity="warning",
                    path=request.url.path,
                    method=request.method,
                    user_id=user_id,
                    client_ip=self._get_client_ip(request),
                )

            # Log admin endpoint access
            elif "/admin" in request.url.path and response.status_code == 200:
                self.security_logger.log_security_event(
                    "admin.endpoint_access",
                    severity="info",
                    path=request.url.path,
                    method=request.method,
                    user_id=user_id,
                    client_ip=self._get_client_ip(request),
                )

            # Log rate limit violations
            elif response.status_code == 429:
                self.security_logger.log_security_event(
                    "security.rate_limit_exceeded",
                    severity="warning",
                    path=request.url.path,
                    client_ip=self._get_client_ip(request),
                    user_agent=request.headers.get("user-agent"),
                )

        except Exception as e:
            # Don't let security logging errors break the request
            self.logger.error(f"Error in security event logging: {e}")

    def _get_client_ip(self, request: Request) -> str:
        """Get the real client IP address."""
        # Check for common proxy headers
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip

        return request.client.host if request.client else "unknown"


class BusinessEventLoggingMixin:
    """Mixin to add business event logging to services."""

    def __init__(self):
        self.logger = get_logger(self.__class__.__module__)

    def log_business_event(self, event_type: str, **data):
        """Log a business event with context."""
        self.logger.log_event(event_type, **data)

    def log_user_action(self, action: str, user_id: str, **data):
        """Log a user action."""
        self.log_business_event(
            f"user.{action}", user_id=user_id, action=action, **data
        )

    def log_admin_action(self, action: str, admin_id: str, target: str = None, **data):
        """Log an admin action."""
        self.log_business_event(
            f"admin.{action}", admin_id=admin_id, action=action, target=target, **data
        )

    def log_booking_event(self, event: str, user_id: str, class_id: str, **data):
        """Log booking-related events."""
        self.log_business_event(
            f"booking.{event}", user_id=user_id, class_id=class_id, event=event, **data
        )

    def log_payment_event(self, event: str, user_id: str, amount: float = None, **data):
        """Log payment-related events."""
        self.log_business_event(
            f"payment.{event}", user_id=user_id, amount=amount, event=event, **data
        )

    def log_package_event(self, event: str, user_id: str, package_id: str, **data):
        """Log package-related events."""
        self.log_business_event(
            f"package.{event}",
            user_id=user_id,
            package_id=package_id,
            event=event,
            **data,
        )


class DatabaseLoggingMixin:
    """Mixin to add database operation logging."""

    def __init__(self):
        self.db_logger = get_logger("app.database")

    def log_query(self, operation: str, table: str, execution_time: float, **kwargs):
        """Log database operations."""
        self.db_logger.log_database_operation(
            operation, table, execution_time, **kwargs
        )

    def log_slow_query(self, query: str, execution_time: float, **kwargs):
        """Log slow queries."""
        self.db_logger.warning(
            f"Slow query detected: {execution_time:.3f}s",
            extra={
                "query": query[:500],  # Truncate long queries
                "execution_time": execution_time,
                "slow_query": True,
                **kwargs,
            },
        )

    def log_failed_query(self, query: str, error: str, **kwargs):
        """Log failed queries."""
        self.db_logger.error(
            f"Query failed: {error}",
            extra={
                "query": query[:500],
                "error": error,
                "failed_query": True,
                **kwargs,
            },
        )
