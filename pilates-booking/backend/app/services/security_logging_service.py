"""
Security Event Logging Service

This service provides comprehensive security event logging for the pilates booking system,
including authentication, authorization, suspicious activity detection, and audit trails.
"""

import hashlib
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional

import redis

from ..core.config import settings
from ..core.logging_config import get_logger


class SecurityEventType(Enum):
    """Security event types for consistent logging."""

    # Authentication Events
    LOGIN_SUCCESS = "auth.login_success"
    LOGIN_FAILED = "auth.login_failed"
    LOGIN_BLOCKED = "auth.login_blocked"
    PASSWORD_RESET_REQUEST = "auth.password_reset_request"
    PASSWORD_RESET_SUCCESS = "auth.password_reset_success"
    PASSWORD_CHANGE = "auth.password_change"
    TOKEN_REFRESH = "auth.token_refresh"
    LOGOUT = "auth.logout"

    # Authorization Events
    PERMISSION_DENIED = "authz.permission_denied"
    ROLE_ESCALATION_ATTEMPT = "authz.role_escalation_attempt"
    UNAUTHORIZED_ENDPOINT = "authz.unauthorized_endpoint"
    ADMIN_ACCESS = "authz.admin_access"

    # Session Management
    SESSION_CREATED = "session.created"
    SESSION_EXPIRED = "session.expired"
    SESSION_TERMINATED = "session.terminated"
    CONCURRENT_SESSION_DETECTED = "session.concurrent_detected"

    # Suspicious Activity
    MULTIPLE_FAILED_LOGINS = "security.multiple_failed_logins"
    UNUSUAL_ACCESS_PATTERN = "security.unusual_access_pattern"
    IP_CHANGE_DETECTED = "security.ip_change_detected"
    RATE_LIMIT_EXCEEDED = "security.rate_limit_exceeded"
    SUSPICIOUS_USER_AGENT = "security.suspicious_user_agent"

    # Data Access
    SENSITIVE_DATA_ACCESS = "data.sensitive_access"
    BULK_DATA_EXPORT = "data.bulk_export"
    USER_DATA_MODIFICATION = "data.user_modification"
    ADMIN_DATA_ACCESS = "data.admin_access"

    # System Security
    SECURITY_SETTING_CHANGED = "system.security_setting_changed"
    ENCRYPTION_KEY_ROTATION = "system.key_rotation"
    BACKUP_CREATED = "system.backup_created"
    BACKUP_RESTORED = "system.backup_restored"

    # Attack Attempts
    SQL_INJECTION_ATTEMPT = "attack.sql_injection"
    XSS_ATTEMPT = "attack.xss"
    CSRF_ATTEMPT = "attack.csrf"
    BRUTE_FORCE_ATTEMPT = "attack.brute_force"
    PATH_TRAVERSAL_ATTEMPT = "attack.path_traversal"


class SecurityThreatLevel(Enum):
    """Security threat levels."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class SecurityEventLogger:
    """Comprehensive security event logger."""

    def __init__(self):
        self.logger = get_logger("app.security")
        self.redis_client = redis.from_url(settings.REDIS_URL)

        # Thresholds for suspicious activity detection
        self.failed_login_threshold = 5
        self.failed_login_window = 300  # 5 minutes
        self.rate_limit_threshold = 100
        self.rate_limit_window = 60  # 1 minute

    def log_security_event(
        self,
        event_type: SecurityEventType,
        threat_level: SecurityThreatLevel,
        user_id: str = None,
        client_ip: str = None,
        user_agent: str = None,
        **additional_data,
    ):
        """Log a security event with standardized format."""

        event_data = {
            "event_type": event_type.value,
            "threat_level": threat_level.value,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "user_id": user_id,
            "client_ip": client_ip,
            "user_agent": user_agent,
            **additional_data,
        }

        # Choose log level based on threat level
        log_level_map = {
            SecurityThreatLevel.LOW: "info",
            SecurityThreatLevel.MEDIUM: "warning",
            SecurityThreatLevel.HIGH: "error",
            SecurityThreatLevel.CRITICAL: "critical",
        }

        log_level = log_level_map[threat_level]

        getattr(self.logger, log_level)(
            f"Security event: {event_type.value} - {threat_level.value}",
            extra={
                "security_event": event_data,
                "event_type": event_type.value,
                "threat_level": threat_level.value,
            },
        )

        # Store in Redis for pattern analysis
        self._store_for_analysis(event_type, client_ip, user_id, event_data)

        # Check for suspicious patterns
        self._analyze_patterns(event_type, client_ip, user_id)

    def log_login_attempt(
        self,
        email: str,
        success: bool,
        client_ip: str,
        user_agent: str,
        user_id: str = None,
        failure_reason: str = None,
    ):
        """Log login attempt with pattern analysis."""

        if success:
            self.log_security_event(
                SecurityEventType.LOGIN_SUCCESS,
                SecurityThreatLevel.LOW,
                user_id=user_id,
                client_ip=client_ip,
                user_agent=user_agent,
                email=email,
            )

            # Clear failed login counter on success
            self._clear_failed_logins(email, client_ip)
        else:
            self.log_security_event(
                SecurityEventType.LOGIN_FAILED,
                SecurityThreatLevel.MEDIUM,
                client_ip=client_ip,
                user_agent=user_agent,
                email=email,
                failure_reason=failure_reason,
            )

            # Track failed logins
            self._track_failed_login(email, client_ip)

    def log_permission_denied(
        self,
        user_id: str,
        requested_resource: str,
        required_permission: str,
        client_ip: str,
        user_agent: str,
    ):
        """Log permission denied events."""

        threat_level = (
            SecurityThreatLevel.HIGH
            if "admin" in requested_resource
            else SecurityThreatLevel.MEDIUM
        )

        self.log_security_event(
            SecurityEventType.PERMISSION_DENIED,
            threat_level,
            user_id=user_id,
            client_ip=client_ip,
            user_agent=user_agent,
            requested_resource=requested_resource,
            required_permission=required_permission,
        )

    def log_admin_access(
        self,
        admin_id: str,
        endpoint: str,
        action: str,
        client_ip: str,
        user_agent: str,
        target_data: Dict = None,
    ):
        """Log admin access and actions."""

        self.log_security_event(
            SecurityEventType.ADMIN_ACCESS,
            SecurityThreatLevel.MEDIUM,
            user_id=admin_id,
            client_ip=client_ip,
            user_agent=user_agent,
            endpoint=endpoint,
            action=action,
            target_data=target_data,
        )

    def log_suspicious_activity(
        self,
        activity_type: str,
        user_id: str = None,
        client_ip: str = None,
        details: Dict = None,
    ):
        """Log suspicious activity detection."""

        self.log_security_event(
            SecurityEventType.UNUSUAL_ACCESS_PATTERN,
            SecurityThreatLevel.HIGH,
            user_id=user_id,
            client_ip=client_ip,
            activity_type=activity_type,
            details=details,
        )

    def log_rate_limit_exceeded(
        self, endpoint: str, client_ip: str, user_agent: str, user_id: str = None
    ):
        """Log rate limit violations."""

        self.log_security_event(
            SecurityEventType.RATE_LIMIT_EXCEEDED,
            SecurityThreatLevel.MEDIUM,
            user_id=user_id,
            client_ip=client_ip,
            user_agent=user_agent,
            endpoint=endpoint,
        )

    def log_attack_attempt(
        self,
        attack_type: SecurityEventType,
        payload: str,
        client_ip: str,
        user_agent: str,
        endpoint: str = None,
    ):
        """Log detected attack attempts."""

        self.log_security_event(
            attack_type,
            SecurityThreatLevel.HIGH,
            client_ip=client_ip,
            user_agent=user_agent,
            endpoint=endpoint,
            payload=payload[:500],  # Truncate payload
        )

    def log_data_access(
        self,
        user_id: str,
        data_type: str,
        operation: str,
        client_ip: str,
        record_count: int = None,
        sensitive: bool = False,
    ):
        """Log data access events."""

        threat_level = (
            SecurityThreatLevel.MEDIUM if sensitive else SecurityThreatLevel.LOW
        )

        if record_count and record_count > 100:  # Bulk access
            self.log_security_event(
                SecurityEventType.BULK_DATA_EXPORT,
                SecurityThreatLevel.HIGH,
                user_id=user_id,
                client_ip=client_ip,
                data_type=data_type,
                operation=operation,
                record_count=record_count,
            )
        else:
            event_type = (
                SecurityEventType.SENSITIVE_DATA_ACCESS
                if sensitive
                else SecurityEventType.USER_DATA_MODIFICATION
            )

            self.log_security_event(
                event_type,
                threat_level,
                user_id=user_id,
                client_ip=client_ip,
                data_type=data_type,
                operation=operation,
                record_count=record_count,
            )

    def _store_for_analysis(
        self,
        event_type: SecurityEventType,
        client_ip: str,
        user_id: str,
        event_data: Dict,
    ):
        """Store event data for pattern analysis."""
        try:
            # Store by IP for IP-based analysis
            if client_ip:
                ip_key = f"security:ip:{client_ip}"
                self.redis_client.lpush(
                    ip_key, f"{event_type.value}:{datetime.utcnow().timestamp()}"
                )
                self.redis_client.expire(ip_key, 3600)  # Keep for 1 hour

            # Store by user for user-based analysis
            if user_id:
                user_key = f"security:user:{user_id}"
                self.redis_client.lpush(
                    user_key, f"{event_type.value}:{datetime.utcnow().timestamp()}"
                )
                self.redis_client.expire(user_key, 3600)  # Keep for 1 hour
        except Exception as e:
            self.logger.error(f"Failed to store security event for analysis: {e}")

    def _track_failed_login(self, email: str, client_ip: str):
        """Track failed login attempts."""
        try:
            current_time = datetime.utcnow().timestamp()

            # Track by email
            email_key = (
                f"failed_logins:email:{hashlib.sha256(email.encode()).hexdigest()}"
            )
            self.redis_client.lpush(email_key, current_time)
            self.redis_client.expire(email_key, self.failed_login_window)

            # Track by IP
            ip_key = f"failed_logins:ip:{client_ip}"
            self.redis_client.lpush(ip_key, current_time)
            self.redis_client.expire(ip_key, self.failed_login_window)

        except Exception as e:
            self.logger.error(f"Failed to track failed login: {e}")

    def _clear_failed_logins(self, email: str, client_ip: str):
        """Clear failed login counters on successful login."""
        try:
            email_key = (
                f"failed_logins:email:{hashlib.sha256(email.encode()).hexdigest()}"
            )
            ip_key = f"failed_logins:ip:{client_ip}"

            self.redis_client.delete(email_key, ip_key)
        except Exception as e:
            self.logger.error(f"Failed to clear failed login counters: {e}")

    def _analyze_patterns(
        self, event_type: SecurityEventType, client_ip: str, user_id: str
    ):
        """Analyze patterns for suspicious activity detection."""
        try:
            current_time = datetime.utcnow().timestamp()

            # Check for multiple failed logins
            if event_type == SecurityEventType.LOGIN_FAILED and client_ip:
                ip_key = f"failed_logins:ip:{client_ip}"
                failed_count = self.redis_client.llen(ip_key)

                if failed_count >= self.failed_login_threshold:
                    self.log_security_event(
                        SecurityEventType.MULTIPLE_FAILED_LOGINS,
                        SecurityThreatLevel.HIGH,
                        client_ip=client_ip,
                        failed_attempts=failed_count,
                    )

            # Check for unusual access patterns
            if client_ip:
                ip_key = f"security:ip:{client_ip}"
                recent_events = self.redis_client.lrange(ip_key, 0, 50)

                # Analyze event frequency
                recent_time_threshold = current_time - 300  # Last 5 minutes
                recent_event_count = sum(
                    1
                    for event in recent_events
                    if float(event.decode().split(":")[1]) > recent_time_threshold
                )

                if recent_event_count > 20:  # High activity threshold
                    self.log_security_event(
                        SecurityEventType.UNUSUAL_ACCESS_PATTERN,
                        SecurityThreatLevel.MEDIUM,
                        client_ip=client_ip,
                        event_count=recent_event_count,
                        pattern="high_frequency_access",
                    )

        except Exception as e:
            self.logger.error(f"Failed to analyze security patterns: {e}")

    def get_security_summary(self, hours: int = 24) -> Dict[str, Any]:
        """Get security event summary for the specified time period."""
        try:
            # This would typically query a log aggregation system
            # For now, return a placeholder structure
            return {
                "period_hours": hours,
                "total_events": 0,
                "threat_levels": {"low": 0, "medium": 0, "high": 0, "critical": 0},
                "top_event_types": [],
                "top_source_ips": [],
                "failed_login_attempts": 0,
                "blocked_ips": [],
            }
        except Exception as e:
            self.logger.error(f"Failed to generate security summary: {e}")
            return {}

    def is_ip_blocked(self, client_ip: str) -> bool:
        """Check if an IP should be blocked based on security events."""
        try:
            ip_key = f"failed_logins:ip:{client_ip}"
            failed_count = self.redis_client.llen(ip_key)

            return failed_count >= self.failed_login_threshold * 2  # Block threshold
        except Exception:
            return False


# Global security logger instance
security_logger = SecurityEventLogger()


# Convenience functions for common security events
def log_login_attempt(
    email: str,
    success: bool,
    client_ip: str,
    user_agent: str,
    user_id: str = None,
    failure_reason: str = None,
):
    """Convenience function to log login attempts."""
    security_logger.log_login_attempt(
        email, success, client_ip, user_agent, user_id, failure_reason
    )


def log_admin_access(
    admin_id: str,
    endpoint: str,
    action: str,
    client_ip: str,
    user_agent: str,
    target_data: Dict = None,
):
    """Convenience function to log admin access."""
    security_logger.log_admin_access(
        admin_id, endpoint, action, client_ip, user_agent, target_data
    )


def log_permission_denied(
    user_id: str,
    requested_resource: str,
    required_permission: str,
    client_ip: str,
    user_agent: str,
):
    """Convenience function to log permission denied events."""
    security_logger.log_permission_denied(
        user_id, requested_resource, required_permission, client_ip, user_agent
    )


def log_attack_attempt(
    attack_type: SecurityEventType,
    payload: str,
    client_ip: str,
    user_agent: str,
    endpoint: str = None,
):
    """Convenience function to log attack attempts."""
    security_logger.log_attack_attempt(
        attack_type, payload, client_ip, user_agent, endpoint
    )
