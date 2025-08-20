import time
import uuid
import redis
import re
from typing import Optional
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from ..core.config import settings


class SecurityMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, redis_client: Optional[redis.Redis] = None):
        super().__init__(app)
        self.redis_client = redis_client or redis.from_url(settings.REDIS_URL)
        
    async def dispatch(self, request: Request, call_next):
        # Add request ID for tracking
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        
        # Add request ID to headers
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        
        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Add API version header
        response.headers["API-Version"] = "v1"
        
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, redis_client: Optional[redis.Redis] = None):
        super().__init__(app)
        self.redis_client = redis_client or redis.from_url(settings.REDIS_URL)
        
    async def dispatch(self, request: Request, call_next):
        # Only apply rate limiting to authentication endpoints
        if request.url.path in ["/api/v1/auth/login", "/api/v1/auth/register"]:
            client_ip = self._get_client_ip(request)
            
            if await self._is_rate_limited(client_ip, request.url.path):
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "detail": "Too many requests. Please try again later.",
                        "retry_after": 60
                    },
                    headers={"Retry-After": "60"}
                )
        
        response = await call_next(request)
        return response
    
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
    
    async def _is_rate_limited(self, client_ip: str, endpoint: str) -> bool:
        """Check if the client is rate limited for the given endpoint."""
        key = f"rate_limit:{endpoint}:{client_ip}"
        current_time = int(time.time())
        window_start = current_time - 60  # 1-minute window
        
        try:
            # Remove old entries
            self.redis_client.zremrangebyscore(key, 0, window_start)
            
            # Count current requests in the window
            current_count = self.redis_client.zcard(key)
            
            if current_count >= settings.LOGIN_RATE_LIMIT_PER_MINUTE:
                return True
            
            # Add current request
            self.redis_client.zadd(key, {str(uuid.uuid4()): current_time})
            self.redis_client.expire(key, 60)  # Expire the key after 1 minute
            
            return False
        except Exception:
            # If Redis is unavailable, allow the request to proceed
            return False


class InputSanitizationMiddleware(BaseHTTPMiddleware):
    """Middleware to sanitize and validate input data."""
    
    def __init__(self, app):
        super().__init__(app)
        # Regex patterns for common attacks
        self.sql_injection_pattern = re.compile(
            r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)",
            re.IGNORECASE
        )
        self.xss_pattern = re.compile(
            r"(<script|javascript:|data:text/html|vbscript:)", 
            re.IGNORECASE
        )
        
    async def dispatch(self, request: Request, call_next):
        # Skip validation for non-POST/PUT/PATCH requests
        if request.method not in ["POST", "PUT", "PATCH"]:
            return await call_next(request)
        
        # Get request body if it exists
        try:
            # Read body only once and store it properly
            body = await request.body()
            
            # Create a new request with the body stored for FastAPI to read later
            async def receive():
                return {"type": "http.request", "body": body}
            
            request._receive = receive
                
            if body:
                body_str = body.decode('utf-8')
                
                # Check for potential SQL injection
                if self.sql_injection_pattern.search(body_str):
                    return JSONResponse(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        content={"detail": "Invalid input detected"}
                    )
                
                # Check for potential XSS
                if self.xss_pattern.search(body_str):
                    return JSONResponse(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        content={"detail": "Invalid input detected"}
                    )
                    
        except Exception:
            # If we can't read the body, let it proceed
            pass
        
        return await call_next(request)


class IPWhitelistMiddleware(BaseHTTPMiddleware):
    """Middleware to restrict admin operations to whitelisted IPs."""
    
    def __init__(self, app, whitelist: Optional[list] = None):
        super().__init__(app)
        self.whitelist = whitelist or []
        
    async def dispatch(self, request: Request, call_next):
        # Only apply to admin endpoints
        if "/admin" in request.url.path and self.whitelist:
            client_ip = self._get_client_ip(request)
            
            if client_ip not in self.whitelist:
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={"detail": "Access denied from your IP address"}
                )
        
        return await call_next(request)
    
    def _get_client_ip(self, request: Request) -> str:
        """Get the real client IP address."""
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        return request.client.host if request.client else "unknown"