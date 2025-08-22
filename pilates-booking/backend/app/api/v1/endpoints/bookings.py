from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from ....core.logging_config import get_logger
from ....models.audit_log import AuditActionType, SecurityLevel
from ....models.user import User
from ....schemas.booking import (BookingCancelRequest, BookingCreate,
                                 BookingResponse, WaitlistEntryResponse)
from ....services.audit_service import AuditService
from ....services.booking_service import BookingService
from ....services.business_logging_service import business_logger
from ..deps import get_current_active_user, get_db

router = APIRouter()
logger = get_logger("app.api.bookings")


def _get_client_ip(request: Request) -> str:
    """Get the real client IP address."""
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip

    return request.client.host if request.client else "unknown"


@router.post("/create", response_model=BookingResponse)
async def create_booking(
    request: Request,
    booking_create: BookingCreate,
    response: Response,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Create a new booking or return existing booking."""
    booking_service = BookingService(db)
    audit_service = AuditService(db)

    client_ip = _get_client_ip(request)
    user_agent = request.headers.get("user-agent", "unknown")

    try:
        logger.info(
            "Booking creation request",
            user_id=str(current_user.id),
            email=current_user.email,
            class_id=booking_create.class_instance_id,
            package_id=booking_create.user_package_id,
            client_ip=client_ip,
        )

        booking = await booking_service.create_booking(
            user=current_user,
            class_instance_id=booking_create.class_instance_id,
            user_package_id=booking_create.user_package_id,
        )

        # Set appropriate status code based on whether booking is new or existing
        if getattr(booking, 'is_new_booking', True):
            response.status_code = status.HTTP_201_CREATED
            audit_action = AuditActionType.BOOKING_CREATE
            log_message = "Booking creation successful"
        else:
            response.status_code = status.HTTP_200_OK
            audit_action = AuditActionType.DATA_ACCESS  
            log_message = "Existing booking returned"

        # Log with audit
        await audit_service.log_from_request(
            request=request,
            action=audit_action,
            user=current_user,
            security_level=SecurityLevel.MEDIUM,
            details={
                "booking_id": str(booking.id),
                "class_instance_id": booking_create.class_instance_id,
                "user_package_id": booking_create.user_package_id,
                "booking_status": booking.status.value,
                "is_new_booking": getattr(booking, 'is_new_booking', True),
            },
        )

        logger.info(
            log_message,
            user_id=str(current_user.id),
            booking_id=str(booking.id),
            class_id=booking_create.class_instance_id,
            status=booking.status.value,
            is_new_booking=getattr(booking, 'is_new_booking', True),
            client_ip=client_ip,
        )

        return booking

    except HTTPException as e:
        # Log failed booking attempt
        logger.warning(
            "Booking creation failed",
            user_id=str(current_user.id),
            class_id=booking_create.class_instance_id,
            client_ip=client_ip,
            reason=str(e.detail),
        )

        await audit_service.log_from_request(
            request=request,
            action=AuditActionType.BOOKING_CREATE,
            user=current_user,
            security_level=SecurityLevel.MEDIUM,
            success="false",
            error_message=str(e.detail),
            details={
                "class_instance_id": booking_create.class_instance_id,
                "user_package_id": booking_create.user_package_id,
            },
        )
        raise
    except Exception as e:
        logger.error(
            "Booking creation failed with exception",
            exc_info=True,
            user_id=str(current_user.id),
            class_id=booking_create.class_instance_id,
            client_ip=client_ip,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Booking creation failed",
        )


@router.delete("/{booking_id}/cancel", response_model=BookingResponse)
async def cancel_booking(
    request: Request,
    booking_id: int,
    cancel_request: BookingCancelRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Cancel a booking."""
    booking_service = BookingService(db)
    audit_service = AuditService(db)

    client_ip = _get_client_ip(request)
    user_agent = request.headers.get("user-agent", "unknown")

    try:
        logger.info(
            "Booking cancellation request",
            user_id=str(current_user.id),
            email=current_user.email,
            booking_id=booking_id,
            reason=cancel_request.reason,
            client_ip=client_ip,
        )

        booking = await booking_service.cancel_booking(
            booking_id=booking_id, user=current_user, reason=cancel_request.reason
        )

        # Log successful booking cancellation
        business_logger.log_booking_cancelled(
            user_id=str(current_user.id),
            booking_id=str(booking.id),
            class_id=str(booking.class_instance_id),
            reason=cancel_request.reason or "user_cancelled",
            credits_refunded=1 if booking.user_package_id is not None else 0,
        )

        await audit_service.log_from_request(
            request=request,
            action=AuditActionType.BOOKING_CANCEL,
            user=current_user,
            security_level=SecurityLevel.MEDIUM,
            details={
                "booking_id": str(booking.id),
                "class_instance_id": str(booking.class_instance_id),
                "cancellation_reason": cancel_request.reason,
                "refund_issued": booking.user_package_id is not None,
            },
        )

        logger.info(
            "Booking cancellation successful",
            user_id=str(current_user.id),
            booking_id=str(booking.id),
            class_id=str(booking.class_instance_id),
            reason=cancel_request.reason,
            client_ip=client_ip,
        )

        return booking

    except HTTPException as e:
        # Log failed cancellation attempt
        logger.warning(
            "Booking cancellation failed",
            user_id=str(current_user.id),
            booking_id=booking_id,
            client_ip=client_ip,
            reason=str(e.detail),
        )

        await audit_service.log_from_request(
            request=request,
            action=AuditActionType.BOOKING_CANCEL,
            user=current_user,
            security_level=SecurityLevel.MEDIUM,
            success="false",
            error_message=str(e.detail),
            details={
                "booking_id": booking_id,
                "cancellation_reason": cancel_request.reason,
            },
        )
        raise
    except Exception as e:
        logger.error(
            "Booking cancellation failed with exception",
            exc_info=True,
            user_id=str(current_user.id),
            booking_id=booking_id,
            client_ip=client_ip,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Booking cancellation failed",
        )


@router.get("/", response_model=List[BookingResponse])
async def get_user_bookings(
    request: Request,
    include_past: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get current user's bookings."""
    booking_service = BookingService(db)
    audit_service = AuditService(db)

    client_ip = _get_client_ip(request)

    try:
        logger.info(
            "User bookings retrieval request",
            user_id=str(current_user.id),
            email=current_user.email,
            include_past=include_past,
            client_ip=client_ip,
        )

        bookings = await booking_service.get_user_bookings(
            user_id=current_user.id, include_past=include_past
        )

        # Log successful retrieval
        logger.info(
            "User bookings retrieved successfully",
            user_id=str(current_user.id),
            bookings_count=len(bookings),
            include_past=include_past,
            client_ip=client_ip,
        )

        # Log data access for audit
        await audit_service.log_from_request(
            request=request,
            action=AuditActionType.DATA_ACCESS,
            user=current_user,
            security_level=SecurityLevel.LOW,
            details={
                "resource": "user_bookings",
                "include_past": include_past,
                "results_count": len(bookings),
            },
        )

        return bookings

    except Exception as e:
        logger.error(
            "User bookings retrieval failed",
            exc_info=True,
            user_id=str(current_user.id),
            client_ip=client_ip,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve bookings",
        )


@router.get("/my-bookings", response_model=List[BookingResponse])
async def get_my_bookings(
    request: Request,
    booking_status: Optional[str] = None,
    upcoming: bool = False,
    limit: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get current user's bookings with filtering options."""
    booking_service = BookingService(db)
    audit_service = AuditService(db)

    client_ip = _get_client_ip(request)

    try:
        logger.info(
            "Filtered user bookings retrieval request",
            user_id=str(current_user.id),
            email=current_user.email,
            status_filter=booking_status,
            upcoming=upcoming,
            limit=limit,
            client_ip=client_ip,
        )

        bookings = await booking_service.get_user_bookings_filtered(
            user_id=current_user.id, status=booking_status, upcoming=upcoming, limit=limit
        )

        # Log successful retrieval
        logger.info(
            "Filtered user bookings retrieved successfully",
            user_id=str(current_user.id),
            bookings_count=len(bookings),
            status_filter=booking_status,
            upcoming=upcoming,
            limit=limit,
            client_ip=client_ip,
        )

        # Log data access for audit
        await audit_service.log_from_request(
            request=request,
            action=AuditActionType.DATA_ACCESS,
            user=current_user,
            security_level=SecurityLevel.LOW,
            details={
                "resource": "user_bookings_filtered",
                "status_filter": booking_status,
                "upcoming": upcoming,
                "limit": limit,
                "results_count": len(bookings),
            },
        )

        return bookings

    except Exception as e:
        logger.error(
            "Filtered user bookings retrieval failed",
            exc_info=True,
            user_id=str(current_user.id),
            client_ip=client_ip,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve bookings",
        )
