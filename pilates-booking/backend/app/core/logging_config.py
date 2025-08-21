import json
import logging
import logging.config
import sys
import traceback
import uuid
from contextvars import ContextVar
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

from .config import settings

# Context variables for request tracking
request_id_ctx: ContextVar[Optional[str]] = ContextVar("request_id", default=None)
user_id_ctx: ContextVar[Optional[str]] = ContextVar("user_id", default=None)
session_id_ctx: ContextVar[Optional[str]] = ContextVar("session_id", default=None)


class SensitiveDataFilter(logging.Filter):
    """Filter to mask sensitive data in logs."""

    SENSITIVE_FIELDS = {
        "password",
        "token",
        "secret",
        "key",
        "authorization",
        "refresh_token",
        "access_token",
        "stripe_secret",
        "credit_card",
        "card_number",
        "cvv",
        "ssn",
        "social_security",
        "api_key",
    }

    def filter(self, record: logging.LogRecord) -> bool:
        if hasattr(record, "msg") and isinstance(record.msg, str):
            record.msg = self._mask_sensitive_data(record.msg)

        if hasattr(record, "args") and record.args:
            record.args = tuple(
                self._mask_sensitive_data(str(arg))
                if isinstance(arg, (str, dict))
                else arg
                for arg in record.args
            )

        return True

    def _mask_sensitive_data(self, text: str) -> str:
        """Mask sensitive data in text."""
        if isinstance(text, dict):
            text = json.dumps(text)

        import re

        for field in self.SENSITIVE_FIELDS:
            # Match field: value patterns (JSON-like)
            pattern = rf'("{field}"\s*:\s*")([^"]+)(")'
            text = re.sub(pattern, r"\1***MASKED***\3", text, flags=re.IGNORECASE)

            # Match field=value patterns (form data)
            pattern = rf"({field}\s*=\s*)([^\s&]+)"
            text = re.sub(pattern, r"\1***MASKED***", text, flags=re.IGNORECASE)

        return text


class JSONFormatter(logging.Formatter):
    """JSON formatter for structured logging."""

    def format(self, record: logging.LogRecord) -> str:
        log_obj = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "service": "pilates-api",
            "environment": settings.ENVIRONMENT,
            "logger": record.name,
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
            "message": record.getMessage(),
        }

        # Add context information
        if request_id := request_id_ctx.get():
            log_obj["request_id"] = request_id

        if user_id := user_id_ctx.get():
            log_obj["user_id"] = user_id

        if session_id := session_id_ctx.get():
            log_obj["session_id"] = session_id

        # Add exception information if present
        if record.exc_info:
            log_obj["exception"] = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
                "traceback": traceback.format_exception(*record.exc_info),
            }

        # Add extra fields if present
        for key, value in record.__dict__.items():
            if key not in {
                "name",
                "msg",
                "args",
                "levelname",
                "levelno",
                "pathname",
                "filename",
                "module",
                "exc_info",
                "exc_text",
                "stack_info",
                "lineno",
                "funcName",
                "created",
                "msecs",
                "relativeCreated",
                "thread",
                "threadName",
                "processName",
                "process",
                "getMessage",
            }:
                log_obj[key] = value

        return json.dumps(log_obj, default=str)


class ColoredFormatter(logging.Formatter):
    """Colored formatter for console output."""

    COLORS = {
        "DEBUG": "\033[36m",  # Cyan
        "INFO": "\033[32m",  # Green
        "WARNING": "\033[33m",  # Yellow
        "ERROR": "\033[31m",  # Red
        "CRITICAL": "\033[35m",  # Magenta
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        # Add color
        color = self.COLORS.get(record.levelname, "")

        # Format timestamp
        dt = datetime.fromtimestamp(record.created)
        timestamp = dt.strftime("%Y-%m-%d %H:%M:%S")

        # Format message with context
        message = record.getMessage()

        context_parts = []
        if request_id := request_id_ctx.get():
            context_parts.append(f"req:{request_id[:8]}")
        if user_id := user_id_ctx.get():
            context_parts.append(f"user:{user_id}")

        context_str = f"[{' '.join(context_parts)}] " if context_parts else ""

        formatted = (
            f"{color}[{timestamp}] {record.levelname:8}{self.RESET} | "
            f"{record.name}:{record.lineno} | {context_str}{message}"
        )

        # Add exception info if present
        if record.exc_info:
            formatted += f"\n{self._format_exception(record.exc_info)}"

        return formatted

    def _format_exception(self, exc_info) -> str:
        """Format exception with color."""
        return f"{self.COLORS['ERROR']}{''.join(traceback.format_exception(*exc_info))}{self.RESET}"


class RequestContextFilter(logging.Filter):
    """Add request context to log records."""

    def filter(self, record: logging.LogRecord) -> bool:
        # Add context from ContextVars
        record.request_id = request_id_ctx.get()
        record.user_id = user_id_ctx.get()
        record.session_id = session_id_ctx.get()

        # Add service metadata
        record.service = "pilates-api"
        record.environment = settings.ENVIRONMENT

        return True


class PilatesLogger:
    """Enhanced logger with business event tracking."""

    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
        self._events_logger = logging.getLogger("app.events")

    def debug(self, message: str, **kwargs):
        """Log debug message."""
        self.logger.debug(message, extra=kwargs)

    def info(self, message: str, **kwargs):
        """Log info message."""
        self.logger.info(message, extra=kwargs)

    def warning(self, message: str, **kwargs):
        """Log warning message."""
        self.logger.warning(message, extra=kwargs)

    def error(self, message: str, exc_info=None, **kwargs):
        """Log error message."""
        self.logger.error(message, exc_info=exc_info, extra=kwargs)

    def critical(self, message: str, exc_info=None, **kwargs):
        """Log critical message."""
        self.logger.critical(message, exc_info=exc_info, extra=kwargs)

    def log_event(self, event_type: str, **data):
        """Log business events with structured data."""
        event_data = {
            "event_type": event_type,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "request_id": request_id_ctx.get(),
            "user_id": user_id_ctx.get(),
            "session_id": session_id_ctx.get(),
            **data,
        }

        self._events_logger.info(
            f"Business event: {event_type}",
            extra={"event_data": event_data, "event_type": event_type},
        )

    def log_api_request(
        self, method: str, path: str, status_code: int, response_time: float, **kwargs
    ):
        """Log API request details."""
        self.log_event(
            "api.request",
            method=method,
            path=path,
            status_code=status_code,
            response_time_ms=response_time * 1000,
            **kwargs,
        )

    def log_security_event(self, event_type: str, severity: str = "info", **data):
        """Log security-related events."""
        security_logger = logging.getLogger("app.security")

        event_data = {
            "security_event": event_type,
            "severity": severity,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "request_id": request_id_ctx.get(),
            "user_id": user_id_ctx.get(),
            **data,
        }

        log_level = getattr(logging, severity.upper(), logging.INFO)
        security_logger.log(
            log_level,
            f"Security event: {event_type}",
            extra={"security_event": event_data, "event_type": event_type},
        )

    def log_database_operation(
        self, operation: str, table: str, execution_time: float, **kwargs
    ):
        """Log database operations."""
        db_logger = logging.getLogger("app.database")

        if execution_time > 0.5:  # Log slow queries
            db_logger.warning(
                f"Slow query detected: {operation} on {table} took {execution_time:.3f}s",
                extra={
                    "operation": operation,
                    "table": table,
                    "execution_time": execution_time,
                    "slow_query": True,
                    **kwargs,
                },
            )
        else:
            db_logger.debug(
                f"Database operation: {operation} on {table}",
                extra={
                    "operation": operation,
                    "table": table,
                    "execution_time": execution_time,
                    **kwargs,
                },
            )


def set_request_context(
    request_id: str = None, user_id: str = None, session_id: str = None
):
    """Set request context for logging."""
    if request_id:
        request_id_ctx.set(request_id)
    if user_id:
        user_id_ctx.set(user_id)
    if session_id:
        session_id_ctx.set(session_id)


def generate_request_id() -> str:
    """Generate a unique request ID."""
    return str(uuid.uuid4())


def clear_request_context():
    """Clear request context."""
    request_id_ctx.set(None)
    user_id_ctx.set(None)
    session_id_ctx.set(None)


def setup_logging() -> None:
    """Set up comprehensive logging configuration."""

    # Create logs directory
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)

    # Determine log level based on environment
    if settings.ENVIRONMENT == "production":
        log_level = "INFO"
        console_level = "WARNING"
    elif settings.ENVIRONMENT == "staging":
        log_level = "INFO"
        console_level = "INFO"
    else:  # development
        log_level = "DEBUG"
        console_level = "DEBUG"

    logging_config: Dict[str, Any] = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "json": {
                "()": JSONFormatter,
            },
            "colored": {
                "()": ColoredFormatter,
                "format": "[%(asctime)s] %(levelname)-8s | %(name)s:%(lineno)d | %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S",
            },
            "detailed": {
                "format": "[%(asctime)s] %(levelname)-8s | %(name)s:%(lineno)d | %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S",
            },
        },
        "filters": {
            "request_context": {
                "()": RequestContextFilter,
            },
            "sensitive_data": {
                "()": SensitiveDataFilter,
            },
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "level": console_level,
                "formatter": "colored",
                "filters": ["request_context", "sensitive_data"],
                "stream": sys.stdout,
            },
            "app_file": {
                "class": "logging.handlers.TimedRotatingFileHandler",
                "level": log_level,
                "formatter": "json",
                "filters": ["request_context", "sensitive_data"],
                "filename": "logs/app.log",
                "when": "midnight",
                "interval": 1,
                "backupCount": 7,
                "encoding": "utf8",
            },
            "error_file": {
                "class": "logging.handlers.TimedRotatingFileHandler",
                "level": "ERROR",
                "formatter": "json",
                "filters": ["request_context", "sensitive_data"],
                "filename": "logs/error.log",
                "when": "midnight",
                "interval": 1,
                "backupCount": 30,
                "encoding": "utf8",
            },
            "access_file": {
                "class": "logging.handlers.TimedRotatingFileHandler",
                "level": "INFO",
                "formatter": "json",
                "filters": ["request_context", "sensitive_data"],
                "filename": "logs/access.log",
                "when": "midnight",
                "interval": 1,
                "backupCount": 7,
                "encoding": "utf8",
            },
            "events_file": {
                "class": "logging.handlers.TimedRotatingFileHandler",
                "level": "INFO",
                "formatter": "json",
                "filters": ["request_context", "sensitive_data"],
                "filename": "logs/events.log",
                "when": "midnight",
                "interval": 1,
                "backupCount": 365,  # Keep business events for 1 year
                "encoding": "utf8",
            },
            "security_file": {
                "class": "logging.handlers.TimedRotatingFileHandler",
                "level": "INFO",
                "formatter": "json",
                "filters": ["request_context", "sensitive_data"],
                "filename": "logs/security.log",
                "when": "midnight",
                "interval": 1,
                "backupCount": 365,  # Keep security events for 1 year
                "encoding": "utf8",
            },
            "database_file": {
                "class": "logging.handlers.TimedRotatingFileHandler",
                "level": "DEBUG",
                "formatter": "json",
                "filters": ["request_context", "sensitive_data"],
                "filename": "logs/database.log",
                "when": "midnight",
                "interval": 1,
                "backupCount": 7,
                "encoding": "utf8",
            },
        },
        "loggers": {
            "app": {
                "level": log_level,
                "handlers": ["console", "app_file", "error_file"],
                "propagate": False,
            },
            "app.events": {
                "level": "INFO",
                "handlers": ["events_file", "app_file"],
                "propagate": False,
            },
            "app.security": {
                "level": "INFO",
                "handlers": ["security_file", "error_file", "console"],
                "propagate": False,
            },
            "app.access": {
                "level": "INFO",
                "handlers": ["access_file"],
                "propagate": False,
            },
            "app.database": {
                "level": "DEBUG",
                "handlers": ["database_file"]
                + (["console"] if log_level == "DEBUG" else []),
                "propagate": False,
            },
            "app.booking": {
                "level": log_level,
                "handlers": ["console", "app_file", "error_file"],
                "propagate": False,
            },
            "app.auth": {
                "level": log_level,
                "handlers": ["console", "app_file", "error_file"],
                "propagate": False,
            },
            "app.payment": {
                "level": log_level,
                "handlers": ["console", "app_file", "error_file"],
                "propagate": False,
            },
            "app.admin": {
                "level": log_level,
                "handlers": ["console", "app_file", "error_file", "security_file"],
                "propagate": False,
            },
            # Third-party loggers
            "uvicorn": {
                "level": "INFO",
                "handlers": ["console", "app_file"],
                "propagate": False,
            },
            "uvicorn.access": {
                "level": "INFO",
                "handlers": ["access_file"],
                "propagate": False,
            },
            "sqlalchemy.engine": {
                "level": "WARNING",
                "handlers": ["database_file"]
                + (["console"] if log_level == "DEBUG" else []),
                "propagate": False,
            },
            "sqlalchemy.dialects": {
                "level": "WARNING",
                "handlers": ["database_file"],
                "propagate": False,
            },
            "stripe": {
                "level": "INFO",
                "handlers": ["app_file", "error_file"],
                "propagate": False,
            },
        },
        "root": {
            "level": "WARNING",
            "handlers": ["console", "app_file"],
        },
    }

    # Apply configuration
    logging.config.dictConfig(logging_config)

    # Initialize main logger and log startup
    logger = PilatesLogger("app")
    logger.info(
        "Comprehensive logging system initialized",
        environment=settings.ENVIRONMENT,
        log_level=log_level,
    )
    logger.log_event(
        "system.startup", environment=settings.ENVIRONMENT, debug_mode=settings.DEBUG
    )


def get_logger(name: str) -> PilatesLogger:
    """Get an enhanced logger with business event tracking."""
    return PilatesLogger(name)


# Convenience loggers for different parts of the application
app_logger = get_logger("app")
access_logger = get_logger("app.access")
booking_logger = get_logger("app.booking")
auth_logger = get_logger("app.auth")
payment_logger = get_logger("app.payment")
admin_logger = get_logger("app.admin")
db_logger = get_logger("app.database")
security_logger = get_logger("app.security")
