import enum

from sqlalchemy import (JSON, Column, DateTime, Enum, ForeignKey, Integer,
                        String, Text)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..core.database import Base


class AuditActionType(str, enum.Enum):
    # Authentication actions
    LOGIN_SUCCESS = "LOGIN_SUCCESS"
    LOGIN_FAILED = "LOGIN_FAILED"
    LOGOUT = "LOGOUT"
    TOKEN_REFRESH = "TOKEN_REFRESH"
    PASSWORD_CHANGE = "PASSWORD_CHANGE"
    PASSWORD_RESET_REQUEST = "PASSWORD_RESET_REQUEST"
    PASSWORD_RESET_SUCCESS = "PASSWORD_RESET_SUCCESS"

    # User management
    USER_CREATE = "USER_CREATE"
    USER_UPDATE = "USER_UPDATE"
    USER_DELETE = "USER_DELETE"
    USER_ACTIVATE = "USER_ACTIVATE"
    USER_DEACTIVATE = "USER_DEACTIVATE"
    EMAIL_VERIFICATION = "EMAIL_VERIFICATION"

    # Security events
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"
    SUSPICIOUS_ACTIVITY = "SUSPICIOUS_ACTIVITY"
    FORCE_LOGOUT_ALL = "FORCE_LOGOUT_ALL"
    TWO_FA_ENABLE = "TWO_FA_ENABLE"
    TWO_FA_DISABLE = "TWO_FA_DISABLE"

    # Administrative actions
    ADMIN_LOGIN = "ADMIN_LOGIN"
    SYSTEM_CONFIG_CHANGE = "SYSTEM_CONFIG_CHANGE"
    BULK_OPERATION = "BULK_OPERATION"

    # Data operations
    DATA_EXPORT = "DATA_EXPORT"
    DATA_ANONYMIZATION = "DATA_ANONYMIZATION"
    GDPR_REQUEST = "GDPR_REQUEST"


class SecurityLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id"), nullable=True
    )  # Allow null for system events
    action = Column(Enum(AuditActionType), nullable=False)
    resource_type = Column(String(50), nullable=True)
    resource_id = Column(Integer, nullable=True)
    security_level = Column(Enum(SecurityLevel), default=SecurityLevel.LOW)
    details = Column(JSON, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    request_id = Column(String(36), nullable=True)  # UUID for request tracking
    success = Column(String(10), default="true")  # "true", "false", "partial"
    error_message = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self):
        return (
            f"<AuditLog(id={self.id}, action='{self.action}', user_id={self.user_id})>"
        )
