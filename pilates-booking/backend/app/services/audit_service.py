from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Request

from ..models.audit_log import AuditLog, AuditActionType, SecurityLevel
from ..models.user import User


class AuditService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def log_security_event(
        self,
        action: AuditActionType,
        user_id: Optional[int] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[int] = None,
        security_level: SecurityLevel = SecurityLevel.LOW,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        request_id: Optional[str] = None,
        success: str = "true",
        error_message: Optional[str] = None
    ) -> AuditLog:
        """Log a security-related event."""
        audit_log = AuditLog(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            security_level=security_level,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent,
            request_id=request_id,
            success=success,
            error_message=error_message
        )
        
        self.db.add(audit_log)
        await self.db.commit()
        await self.db.refresh(audit_log)
        return audit_log

    async def log_from_request(
        self,
        request: Request,
        action: AuditActionType,
        user: Optional[User] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[int] = None,
        security_level: SecurityLevel = SecurityLevel.LOW,
        details: Optional[Dict[str, Any]] = None,
        success: str = "true",
        error_message: Optional[str] = None
    ) -> AuditLog:
        """Log an event from a FastAPI request."""
        ip_address = self._get_client_ip(request)
        user_agent = request.headers.get("User-Agent")
        request_id = getattr(request.state, "request_id", None)
        
        return await self.log_security_event(
            action=action,
            user_id=user.id if user else None,
            resource_type=resource_type,
            resource_id=resource_id,
            security_level=security_level,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent,
            request_id=request_id,
            success=success,
            error_message=error_message
        )

    def _get_client_ip(self, request: Request) -> str:
        """Get the real client IP address."""
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        return request.client.host if request.client else "unknown"

    async def log_login_attempt(
        self,
        request: Request,
        email: str,
        success: bool,
        user: Optional[User] = None,
        error_message: Optional[str] = None
    ):
        """Log a login attempt."""
        action = AuditActionType.LOGIN_SUCCESS if success else AuditActionType.LOGIN_FAILED
        security_level = SecurityLevel.MEDIUM if success else SecurityLevel.HIGH
        
        details = {
            "email": email,
            "timestamp": str(request.state.request_id) if hasattr(request.state, "request_id") else None
        }
        
        await self.log_from_request(
            request=request,
            action=action,
            user=user,
            security_level=security_level,
            details=details,
            success="true" if success else "false",
            error_message=error_message
        )

    async def log_password_change(
        self,
        request: Request,
        user: User,
        success: bool = True
    ):
        """Log a password change event."""
        await self.log_from_request(
            request=request,
            action=AuditActionType.PASSWORD_CHANGE,
            user=user,
            security_level=SecurityLevel.HIGH,
            success="true" if success else "false"
        )

    async def log_admin_action(
        self,
        request: Request,
        user: User,
        action: str,
        resource_type: str,
        resource_id: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        """Log an administrative action."""
        await self.log_from_request(
            request=request,
            action=AuditActionType.ADMIN_LOGIN,  # Use appropriate admin action
            user=user,
            resource_type=resource_type,
            resource_id=resource_id,
            security_level=SecurityLevel.CRITICAL,
            details={**(details or {}), "admin_action": action}
        )

    async def log_rate_limit_exceeded(
        self,
        request: Request,
        endpoint: str
    ):
        """Log when rate limiting is triggered."""
        await self.log_from_request(
            request=request,
            action=AuditActionType.RATE_LIMIT_EXCEEDED,
            security_level=SecurityLevel.MEDIUM,
            details={"endpoint": endpoint},
            success="false"
        )