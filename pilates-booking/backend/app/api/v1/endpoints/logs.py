"""
Mobile Log Collection Endpoints

This module provides endpoints for collecting logs and events from mobile applications.
It handles log ingestion, validation, and forwarding to the centralized logging system.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, validator

from ....core.logging_config import get_logger
from ....services.business_logging_service import business_logger

router = APIRouter()
logger = get_logger("app.mobile_logs")


class DeviceInfo(BaseModel):
    """Device information from mobile app."""

    brand: str
    model: str
    system_version: str = Field(alias="systemVersion")
    app_version: str = Field(alias="appVersion")
    build_number: str = Field(alias="buildNumber")
    bundle_id: str = Field(alias="bundleId")
    device_id: str = Field(alias="deviceId")
    is_emulator: bool = Field(alias="isEmulator")

    class Config:
        allow_population_by_field_name = True


class NetworkInfo(BaseModel):
    """Network information from mobile app."""

    is_connected: bool = Field(alias="isConnected")
    type: str
    is_internet_reachable: bool = Field(alias="isInternetReachable")

    class Config:
        allow_population_by_field_name = True


class LogContext(BaseModel):
    """Log context from mobile app."""

    user_id: Optional[str] = Field(None, alias="userId")
    session_id: str = Field(alias="sessionId")
    request_id: Optional[str] = Field(None, alias="requestId")
    screen: Optional[str] = None
    component: Optional[str] = None
    platform: str
    app_version: str = Field(alias="appVersion")
    device_info: DeviceInfo = Field(alias="deviceInfo")
    network_info: Optional[NetworkInfo] = Field(None, alias="networkInfo")

    class Config:
        allow_population_by_field_name = True


class MobileLogEntry(BaseModel):
    """Mobile log entry model."""

    id: str
    timestamp: str
    level: str
    message: str
    context: LogContext
    extra: Optional[Dict[str, Any]] = None
    stack_trace: Optional[str] = Field(None, alias="stackTrace")

    class Config:
        allow_population_by_field_name = True

    @validator("level")
    def validate_level(cls, v):
        valid_levels = ["DEBUG", "INFO", "WARN", "ERROR", "CRITICAL"]
        if v.upper() not in valid_levels:
            raise ValueError(f"Invalid log level: {v}")
        return v.upper()

    @validator("timestamp")
    def validate_timestamp(cls, v):
        try:
            datetime.fromisoformat(v.replace("Z", "+00:00"))
            return v
        except ValueError:
            raise ValueError("Invalid timestamp format")


class MobileEventData(BaseModel):
    """Mobile event data model."""

    event_type: str = Field(alias="eventType")
    properties: Dict[str, Any]
    timestamp: str
    context: LogContext

    class Config:
        allow_population_by_field_name = True

    @validator("timestamp")
    def validate_timestamp(cls, v):
        try:
            datetime.fromisoformat(v.replace("Z", "+00:00"))
            return v
        except ValueError:
            raise ValueError("Invalid timestamp format")


class MobileLogBatch(BaseModel):
    """Batch of mobile logs."""

    logs: List[MobileLogEntry]
    session_id: str = Field(alias="sessionId")
    device_info: DeviceInfo = Field(alias="deviceInfo")

    class Config:
        allow_population_by_field_name = True

    @validator("logs")
    def validate_logs_count(cls, v):
        if len(v) > 100:  # Prevent abuse
            raise ValueError("Too many logs in batch (max 100)")
        return v


class MobileEventBatch(BaseModel):
    """Batch of mobile events."""

    events: List[MobileEventData]
    session_id: str = Field(alias="sessionId")
    device_info: DeviceInfo = Field(alias="deviceInfo")

    class Config:
        allow_population_by_field_name = True

    @validator("events")
    def validate_events_count(cls, v):
        if len(v) > 100:  # Prevent abuse
            raise ValueError("Too many events in batch (max 100)")
        return v


@router.post(
    "/mobile",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Collect mobile app logs",
    description="Endpoint for mobile applications to submit log batches",
)
async def collect_mobile_logs(log_batch: MobileLogBatch, request: Request):
    """
    Collect and process mobile application logs.

    This endpoint receives batched logs from mobile applications and forwards them
    to the centralized logging system with proper context and metadata.
    """

    try:
        client_ip = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "unknown")

        # Log the batch receipt
        logger.info(
            f"Received mobile log batch: {len(log_batch.logs)} logs from {log_batch.device_info.platform}",
            extra={
                "batch_size": len(log_batch.logs),
                "session_id": log_batch.session_id,
                "platform": log_batch.device_info.platform,
                "app_version": log_batch.device_info.app_version,
                "device_model": f"{log_batch.device_info.brand} {log_batch.device_info.model}",
                "client_ip": client_ip,
                "user_agent": user_agent,
            },
        )

        # Process each log entry
        processed_count = 0
        error_count = 0

        for log_entry in log_batch.logs:
            try:
                # Forward to centralized logging with mobile prefix
                mobile_logger = get_logger("app.mobile")

                # Prepare log data
                log_data = {
                    "mobile_log_id": log_entry.id,
                    "original_timestamp": log_entry.timestamp,
                    "session_id": log_entry.context.session_id,
                    "user_id": log_entry.context.user_id,
                    "screen": log_entry.context.screen,
                    "component": log_entry.context.component,
                    "platform": log_entry.context.platform,
                    "app_version": log_entry.context.app_version,
                    "device_info": log_entry.context.device_info.dict(),
                    "network_info": log_entry.context.network_info.dict()
                    if log_entry.context.network_info
                    else None,
                    "client_ip": client_ip,
                    "extra": log_entry.extra,
                    "stack_trace": log_entry.stack_trace,
                }

                # Log with appropriate level
                log_level = log_entry.level.lower()
                if hasattr(mobile_logger, log_level):
                    getattr(mobile_logger, log_level)(
                        f"[Mobile] {log_entry.message}", **log_data
                    )
                else:
                    mobile_logger.info(
                        f"[Mobile:{log_entry.level}] {log_entry.message}", **log_data
                    )

                # Track business events for specific log types
                if (
                    log_entry.level in ["ERROR", "CRITICAL"]
                    and log_entry.context.user_id
                ):
                    business_logger.log_event(
                        "mobile.error",
                        user_id=log_entry.context.user_id,
                        error_level=log_entry.level,
                        error_message=log_entry.message,
                        platform=log_entry.context.platform,
                        app_version=log_entry.context.app_version,
                        screen=log_entry.context.screen,
                    )

                processed_count += 1

            except Exception as e:
                logger.error(
                    f"Failed to process mobile log entry {log_entry.id}: {e}",
                    extra={"log_entry_id": log_entry.id, "error": str(e)},
                )
                error_count += 1

        # Log processing summary
        logger.info(
            f"Mobile log batch processed: {processed_count} success, {error_count} errors",
            extra={
                "session_id": log_batch.session_id,
                "processed_count": processed_count,
                "error_count": error_count,
                "total_count": len(log_batch.logs),
            },
        )

        return {
            "status": "accepted",
            "processed": processed_count,
            "errors": error_count,
            "total": len(log_batch.logs),
        }

    except Exception as e:
        logger.error(
            f"Failed to process mobile log batch: {e}",
            exc_info=True,
            extra={
                "session_id": log_batch.session_id if "log_batch" in locals() else None,
                "error": str(e),
            },
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process log batch",
        )


@router.post(
    "/mobile/events",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Collect mobile app events",
    description="Endpoint for mobile applications to submit event batches",
)
async def collect_mobile_events(event_batch: MobileEventBatch, request: Request):
    """
    Collect and process mobile application events.

    This endpoint receives batched events from mobile applications and forwards them
    to the business event logging system.
    """

    try:
        client_ip = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "unknown")

        # Log the batch receipt
        logger.info(
            f"Received mobile event batch: {len(event_batch.events)} events from {event_batch.device_info.platform}",
            extra={
                "batch_size": len(event_batch.events),
                "session_id": event_batch.session_id,
                "platform": event_batch.device_info.platform,
                "app_version": event_batch.device_info.app_version,
                "device_model": f"{event_batch.device_info.brand} {event_batch.device_info.model}",
                "client_ip": client_ip,
            },
        )

        # Process each event
        processed_count = 0
        error_count = 0

        for event in event_batch.events:
            try:
                # Forward to business event logging
                business_logger.log_event(
                    f"mobile.{event.event_type}",
                    user_id=event.context.user_id,
                    session_id=event.context.session_id,
                    platform=event.context.platform,
                    app_version=event.context.app_version,
                    screen=event.context.screen,
                    device_info=event.context.device_info.dict(),
                    client_ip=client_ip,
                    original_timestamp=event.timestamp,
                    **event.properties,
                )

                processed_count += 1

            except Exception as e:
                logger.error(
                    f"Failed to process mobile event {event.event_type}: {e}",
                    extra={"event_type": event.event_type, "error": str(e)},
                )
                error_count += 1

        # Log processing summary
        logger.info(
            f"Mobile event batch processed: {processed_count} success, {error_count} errors",
            extra={
                "session_id": event_batch.session_id,
                "processed_count": processed_count,
                "error_count": error_count,
                "total_count": len(event_batch.events),
            },
        )

        return {
            "status": "accepted",
            "processed": processed_count,
            "errors": error_count,
            "total": len(event_batch.events),
        }

    except Exception as e:
        logger.error(
            f"Failed to process mobile event batch: {e}",
            exc_info=True,
            extra={
                "session_id": event_batch.session_id
                if "event_batch" in locals()
                else None,
                "error": str(e),
            },
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process event batch",
        )


@router.get(
    "/mobile/health",
    summary="Mobile logging health check",
    description="Health check endpoint for mobile logging service",
)
async def mobile_logging_health():
    """
    Health check endpoint for mobile logging service.

    Returns the current status of the mobile logging collection service.
    """
    return {
        "status": "healthy",
        "service": "mobile-logging",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "max_batch_size": 100,
        "supported_platforms": ["ios", "android"],
    }
