import logging
import logging.config
import sys
from typing import Dict, Any
from datetime import datetime
from pathlib import Path

from .config import settings


class CustomFormatter(logging.Formatter):
    """Custom formatter with colors for different log levels."""
    
    COLORS = {
        'DEBUG': '\033[36m',      # Cyan
        'INFO': '\033[32m',       # Green
        'WARNING': '\033[33m',    # Yellow
        'ERROR': '\033[31m',      # Red
        'CRITICAL': '\033[35m',   # Magenta
    }
    RESET = '\033[0m'
    
    def format(self, record: logging.LogRecord) -> str:
        # Add color for console output
        if hasattr(record, 'levelname'):
            color = self.COLORS.get(record.levelname, '')
            record.levelname = f"{color}{record.levelname}{self.RESET}"
        
        # Add request ID if available
        if hasattr(record, 'request_id'):
            record.msg = f"[{record.request_id}] {record.msg}"
        
        return super().format(record)


class RequestContextFilter(logging.Filter):
    """Add request context to log records."""
    
    def filter(self, record: logging.LogRecord) -> bool:
        # Add timestamp in a readable format
        record.timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Add service name
        record.service = "pilates-api"
        
        return True


def setup_logging() -> None:
    """Set up logging configuration."""
    
    # Create logs directory if it doesn't exist
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)
    
    # Determine log level
    log_level = "DEBUG" if settings.DEBUG else "INFO"
    
    logging_config: Dict[str, Any] = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "detailed": {
                "format": "[{timestamp}] {levelname:8} | {service} | {name}:{lineno} | {message}",
                "style": "{",
            },
            "simple": {
                "format": "{levelname:8} | {name} | {message}",
                "style": "{",
            },
            "json": {
                "format": '{{"timestamp": "{timestamp}", "level": "{levelname}", "service": "{service}", "logger": "{name}", "line": {lineno}, "message": "{message}"}}',
                "style": "{",
            },
            "colored": {
                "()": CustomFormatter,
                "format": "[{timestamp}] {levelname:8} | {service} | {name}:{lineno} | {message}",
                "style": "{",
            },
        },
        "filters": {
            "request_context": {
                "()": RequestContextFilter,
            },
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "level": log_level,
                "formatter": "colored",
                "filters": ["request_context"],
                "stream": sys.stdout,
            },
            "file": {
                "class": "logging.handlers.RotatingFileHandler",
                "level": "INFO",
                "formatter": "detailed",
                "filters": ["request_context"],
                "filename": "logs/app.log",
                "maxBytes": 10485760,  # 10MB
                "backupCount": 5,
                "encoding": "utf8",
            },
            "error_file": {
                "class": "logging.handlers.RotatingFileHandler",
                "level": "ERROR",
                "formatter": "detailed",
                "filters": ["request_context"],
                "filename": "logs/error.log",
                "maxBytes": 10485760,  # 10MB
                "backupCount": 3,
                "encoding": "utf8",
            },
            "access_file": {
                "class": "logging.handlers.RotatingFileHandler",
                "level": "INFO",
                "formatter": "json",
                "filters": ["request_context"],
                "filename": "logs/access.log",
                "maxBytes": 10485760,  # 10MB
                "backupCount": 5,
                "encoding": "utf8",
            },
        },
        "loggers": {
            "app": {
                "level": log_level,
                "handlers": ["console", "file", "error_file"],
                "propagate": False,
            },
            "app.access": {
                "level": "INFO",
                "handlers": ["access_file"],
                "propagate": False,
            },
            "app.booking": {
                "level": log_level,
                "handlers": ["console", "file", "error_file"],
                "propagate": False,
            },
            "app.auth": {
                "level": log_level,
                "handlers": ["console", "file", "error_file"],
                "propagate": False,
            },
            "app.database": {
                "level": "WARNING",  # Reduce database noise
                "handlers": ["console", "file", "error_file"],
                "propagate": False,
            },
            "sqlalchemy.engine": {
                "level": "WARNING",  # Reduce SQL noise in production
                "handlers": ["file"] if not settings.DEBUG else ["console", "file"],
                "propagate": False,
            },
            "sqlalchemy.dialects": {
                "level": "WARNING",
                "handlers": ["file"],
                "propagate": False,
            },
            "uvicorn": {
                "level": "INFO",
                "handlers": ["console", "file"],
                "propagate": False,
            },
            "uvicorn.access": {
                "level": "INFO",
                "handlers": ["access_file"],
                "propagate": False,
            },
        },
        "root": {
            "level": "WARNING",
            "handlers": ["console", "file"],
        },
    }
    
    # Apply configuration
    logging.config.dictConfig(logging_config)
    
    # Get the main logger and log startup
    logger = logging.getLogger("app")
    logger.info("Logging system initialized")
    logger.info(f"Log level set to: {log_level}")
    logger.info(f"Debug mode: {settings.DEBUG}")


def get_logger(name: str) -> logging.Logger:
    """Get a logger with the specified name."""
    return logging.getLogger(name)


# Convenience loggers for different parts of the application
app_logger = get_logger("app")
access_logger = get_logger("app.access")
booking_logger = get_logger("app.booking")
auth_logger = get_logger("app.auth")
db_logger = get_logger("app.database")