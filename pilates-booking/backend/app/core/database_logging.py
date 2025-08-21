"""
Database Logging Integration

This module provides comprehensive database operation logging, including
query monitoring, performance tracking, and error logging.
"""

import time
from typing import Any, Dict, Optional

from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.pool import Pool

from .logging_config import get_logger


class DatabaseLogger:
    """Enhanced database logger for monitoring queries and performance."""

    def __init__(self):
        self.logger = get_logger("app.database")
        self.performance_logger = get_logger("app.performance")

        # Query tracking
        self._query_start_times = {}

    def setup_event_listeners(self, engine: Engine):
        """Set up SQLAlchemy event listeners for comprehensive logging."""

        # Query execution events
        event.listen(
            engine.sync_engine, "before_cursor_execute", self._before_cursor_execute
        )
        event.listen(
            engine.sync_engine, "after_cursor_execute", self._after_cursor_execute
        )

        # Connection events
        event.listen(engine.sync_engine, "connect", self._on_connect)
        event.listen(engine.sync_engine, "checkout", self._on_checkout)
        event.listen(engine.sync_engine, "checkin", self._on_checkin)

        # Pool events
        event.listen(Pool, "connect", self._on_pool_connect)
        event.listen(Pool, "checkout", self._on_pool_checkout)
        event.listen(Pool, "checkin", self._on_pool_checkin)
        event.listen(Pool, "invalidate", self._on_pool_invalidate)

    def _before_cursor_execute(
        self, conn, cursor, statement, parameters, context, executemany
    ):
        """Log before query execution."""
        context._query_start_time = time.time()

        # Log query start for debugging
        self.logger.debug(
            f"Executing query: {statement[:100]}...",
            extra={
                "query": statement,
                "parameters": self._sanitize_parameters(parameters),
                "executemany": executemany,
            },
        )

    def _after_cursor_execute(
        self, conn, cursor, statement, parameters, context, executemany
    ):
        """Log after query execution with performance metrics."""
        execution_time = time.time() - context._query_start_time

        # Determine query type
        query_type = (
            statement.strip().split()[0].upper() if statement.strip() else "UNKNOWN"
        )

        # Extract table name from query (basic extraction)
        table_name = self._extract_table_name(statement)

        # Log based on execution time and query type
        if execution_time > 0.5:  # Slow query threshold
            self.logger.warning(
                f"Slow query detected: {query_type} on {table_name} took {execution_time:.3f}s",
                extra={
                    "query_type": query_type,
                    "table": table_name,
                    "execution_time": execution_time,
                    "slow_query": True,
                    "query": statement[:500],  # Truncate long queries
                    "parameters": self._sanitize_parameters(parameters),
                },
            )
        else:
            self.logger.debug(
                f"Query completed: {query_type} on {table_name} in {execution_time:.3f}s",
                extra={
                    "query_type": query_type,
                    "table": table_name,
                    "execution_time": execution_time,
                    "query": statement[:200],
                },
            )

        # Log to performance logger for metrics
        self.performance_logger.info(
            f"Database query performance",
            extra={
                "metric_type": "database_query",
                "query_type": query_type,
                "table": table_name,
                "execution_time": execution_time,
                "slow_query": execution_time > 0.5,
            },
        )

    def _on_connect(self, dbapi_connection, connection_record):
        """Log database connections."""
        self.logger.info(
            "New database connection established",
            extra={
                "connection_id": id(dbapi_connection),
                "event": "connection_established",
            },
        )

    def _on_checkout(self, dbapi_connection, connection_record, connection_proxy):
        """Log connection checkout from pool."""
        self.logger.debug(
            "Connection checked out from pool",
            extra={
                "connection_id": id(dbapi_connection),
                "event": "connection_checkout",
            },
        )

    def _on_checkin(self, dbapi_connection, connection_record):
        """Log connection checkin to pool."""
        self.logger.debug(
            "Connection checked in to pool",
            extra={
                "connection_id": id(dbapi_connection),
                "event": "connection_checkin",
            },
        )

    def _on_pool_connect(self, dbapi_connection, connection_record):
        """Log pool connection events."""
        self.logger.info(
            "Pool connection created",
            extra={
                "connection_id": id(dbapi_connection),
                "event": "pool_connection_created",
            },
        )

    def _on_pool_checkout(self, dbapi_connection, connection_record, connection_proxy):
        """Log pool checkout events."""
        pool = connection_record.info.get("pool")
        if pool:
            self.logger.debug(
                f"Pool checkout - Size: {pool.size()}, Checked out: {pool.checkedout()}",
                extra={
                    "pool_size": pool.size(),
                    "checked_out": pool.checkedout(),
                    "overflow": pool.overflow(),
                    "event": "pool_checkout",
                },
            )

    def _on_pool_checkin(self, dbapi_connection, connection_record):
        """Log pool checkin events."""
        self.logger.debug(
            "Connection returned to pool",
            extra={"connection_id": id(dbapi_connection), "event": "pool_checkin"},
        )

    def _on_pool_invalidate(self, dbapi_connection, connection_record, exception):
        """Log pool invalidation events."""
        self.logger.warning(
            f"Pool connection invalidated: {exception}",
            extra={
                "connection_id": id(dbapi_connection),
                "exception": str(exception),
                "event": "pool_invalidation",
            },
        )

    def _sanitize_parameters(self, parameters) -> Dict[str, Any]:
        """Sanitize query parameters to remove sensitive data."""
        if not parameters:
            return {}

        if isinstance(parameters, dict):
            sanitized = {}
            for key, value in parameters.items():
                if any(
                    sensitive in key.lower()
                    for sensitive in ["password", "token", "secret", "key"]
                ):
                    sanitized[key] = "***MASKED***"
                else:
                    sanitized[key] = str(value)[:100]  # Truncate long values
            return sanitized
        elif isinstance(parameters, (list, tuple)):
            return [
                str(param)[:100] if param else None for param in parameters[:10]
            ]  # Limit array size
        else:
            return {"params": str(parameters)[:100]}

    def _extract_table_name(self, statement: str) -> str:
        """Extract table name from SQL statement."""
        try:
            statement_upper = statement.upper().strip()

            # Handle common SQL patterns
            if statement_upper.startswith("SELECT"):
                if " FROM " in statement_upper:
                    from_index = statement_upper.find(" FROM ") + 6
                    after_from = statement_upper[from_index:].strip()
                    table_name = after_from.split()[0]
                    return table_name.strip('`"[]')
            elif statement_upper.startswith(("INSERT", "UPDATE", "DELETE")):
                if statement_upper.startswith("INSERT INTO"):
                    into_index = statement_upper.find("INTO ") + 5
                    after_into = statement_upper[into_index:].strip()
                    table_name = after_into.split()[0]
                    return table_name.strip('`"[]')
                elif statement_upper.startswith("UPDATE"):
                    update_index = statement_upper.find("UPDATE ") + 7
                    after_update = statement_upper[update_index:].strip()
                    table_name = after_update.split()[0]
                    return table_name.strip('`"[]')
                elif statement_upper.startswith("DELETE FROM"):
                    from_index = statement_upper.find("FROM ") + 5
                    after_from = statement_upper[from_index:].strip()
                    table_name = after_from.split()[0]
                    return table_name.strip('`"[]')

            return "unknown"
        except Exception:
            return "unknown"

    def log_transaction_start(self, session: AsyncSession):
        """Log transaction start."""
        self.logger.debug(
            "Database transaction started",
            extra={"session_id": id(session), "event": "transaction_start"},
        )

    def log_transaction_commit(self, session: AsyncSession):
        """Log transaction commit."""
        self.logger.debug(
            "Database transaction committed",
            extra={"session_id": id(session), "event": "transaction_commit"},
        )

    def log_transaction_rollback(
        self, session: AsyncSession, exception: Exception = None
    ):
        """Log transaction rollback."""
        self.logger.warning(
            f"Database transaction rolled back: {exception if exception else 'Manual rollback'}",
            extra={
                "session_id": id(session),
                "exception": str(exception) if exception else None,
                "event": "transaction_rollback",
            },
        )

    def log_migration_start(self, revision: str, message: str):
        """Log migration start."""
        self.logger.info(
            f"Database migration started: {revision} - {message}",
            extra={
                "revision": revision,
                "message": message,
                "event": "migration_start",
            },
        )

    def log_migration_complete(self, revision: str, message: str, duration: float):
        """Log migration completion."""
        self.logger.info(
            f"Database migration completed: {revision} - {message} in {duration:.2f}s",
            extra={
                "revision": revision,
                "message": message,
                "duration": duration,
                "event": "migration_complete",
            },
        )


class LoggedAsyncSession(AsyncSession):
    """AsyncSession with enhanced logging capabilities."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.db_logger = DatabaseLogger()

    async def begin(self):
        """Begin transaction with logging."""
        result = await super().begin()
        self.db_logger.log_transaction_start(self)
        return result

    async def commit(self):
        """Commit transaction with logging."""
        try:
            result = await super().commit()
            self.db_logger.log_transaction_commit(self)
            return result
        except Exception as e:
            self.db_logger.log_transaction_rollback(self, e)
            raise

    async def rollback(self):
        """Rollback transaction with logging."""
        result = await super().rollback()
        self.db_logger.log_transaction_rollback(self)
        return result


# Global database logger instance
db_logger = DatabaseLogger()


def setup_database_logging(engine):
    """Set up database logging for the given engine."""
    db_logger.setup_event_listeners(engine)

    # Log database connection setup
    logger = get_logger("app.database")
    logger.info(
        "Database logging initialized",
        extra={"engine": str(engine.url), "event": "logging_setup"},
    )
